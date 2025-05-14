import Notes, { contentsModel, mcqsModel, linksModel, filesModel } from "../schemas/posts.model"
import Students from "../schemas/users.model"
import mongoose from "mongoose"
import { isUpvoted } from "./vote.service"
import { PostType } from "../schemas/posts.model"
import { deleteFile } from "./firebase.service"

interface SavedNoteObject {
    noteID: string,
    noteTitle: string,
    noteThumbnail: string
}

export async function addPost(postData: any, postType?: PostType) {
    try {
        let post = null
        if (postType === PostType.CONTENT) {
            post = await contentsModel.create(postData)
        } else if (postType === PostType.MCQ) {
            post = await mcqsModel.create(postData)
        } else if (postType === PostType.LINK) {
            post = await linksModel.create(postData);
        } else if (postType === PostType.FILE) {
            post = await filesModel.create(postData)
        }

        if (post) {
            await Students.findByIdAndUpdate(
                postData.ownerDocID,
                { $push: { owned_notes: post._id } },
                { upsert: true, new: true }
            )
            return { ok: true, postID: post._id }
        } else {
            return { ok: false }
        }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function deletePost(postID: string, postType: PostType) {
    try {
        if (postType === PostType.CONTENT || postType === PostType.FILE) {
            await Notes.deleteOne({ postID: postID })
            const fileDeleteResponse = await deleteFile(postID)
            return { ok: fileDeleteResponse.ok, code: !fileDeleteResponse.ok ? "FILE_DELETE_FAIL" : null }
        }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function isSaved(userDocID: string, postDocID: string) {
    let document = await Students.findOne({
        $and:
            [
                { _id: userDocID },
                { saved_notes: { $in: [postDocID] } }
            ]
    })
    return document ? true : false
}
export async function getPosts(studentDocID: string, options?: { skip: number, limit: number, seed: number }) {
    /*
    Linear Congruential Generator (LCG):
        X_n+1 = (A * X_n + C) mod M

        A = feedbackCount + 1234567
        C = (upvoteCount + 10) × 9876543 + (contentSize × 22695477)
        M = 2 ^ 32
        X_n = seed
    */
    try {
        const posts = await Notes.aggregate([
            { $match: { completed: { $eq: true }, visibility: "public", postType: PostType.CONTENT } },
            { $lookup: {
                from: 'students',
                localField: 'ownerDocID',
                foreignField: '_id',
                as: 'owner'
            } },
            { $unwind: {
                path: '$owner',
            } },
            { $addFields: {
                viewerDocID: new mongoose.Types.ObjectId(studentDocID),
            } },
            { $lookup: {
                from: 'students',
                localField: 'viewerDocID',
                foreignField: '_id',
                as: 'viewer'
            } },
            { $unwind: {
                path: '$viewer',
            } },
            { $addFields: {
                A: { $add: ["$feedbackCount", 1234567] },
                C: {
                    $add: [
                        { $multiply: [{ $add: ["$upvoteCount", 10] }, 9876543] },
                        { $multiply: [{ $add: [{ $size: "$content" }, 1] }, 22695477] }
                    ]
                },
                isPostOwner: {
                    $cond: [
                        { $eq: ["$ownerDocID", "$viewerDocID"] },
                        true,
                        false
                    ]
                },
                interactionData: {
                    feedbackCount: "$feedbackCount",
                    upvoteCount: "$upvoteCount",
                    isSaved: {
                        $cond: [
                            { $in: ["$_id", "$viewer.saved_notes"] },
                            true,
                            false
                        ]
                    }
                }
            } },
            { $addFields: {
                randomSort: {
                    $mod: [
                        { $add: [{ $multiply: ["$A", options.seed] }, "$C"] },
                        Math.pow(2, 32)
                    ]
                },
            } },
            { $project: {
                content: 0
            } },
            { $sort: { randomSort: 1, _id: 1 } },
            { $skip: options.skip },
            { $limit: options.limit },
        ])

        const modifiedPosts = posts.length !== 0 && await Promise.all(posts.map(async post => {
            const isPostUpvoted = await isUpvoted(post?.["_id"]?.toString(), studentDocID)
            return { ...post, interactionData: { ...post?.interactionData, isUpvoted: isPostUpvoted } }
        }))
    
        return { ok: true, posts: posts.length !== 0 ? modifiedPosts : [] }
    } catch (error) {
        return { ok: false, error: error }
    }
}


export async function getSinglePost(postID: string, userDocID: string) {
    try {
        const post = await Notes.aggregate([
            { $match: { postID: postID, completed: true } },
            { $lookup: {
                from: "students",
                localField: "ownerDocID",
                foreignField: "_id",
                as: "owner"
            } },
            { $unwind: {
                path: "$owner"
            } },
            { $addFields: {
                viewerDocID: new mongoose.Types.ObjectId(userDocID)
            } },
            { $lookup: {
                from: "students",
                localField: "viewerDocID",
                foreignField: "_id",
                as: "viewer"
            } },
            { $unwind: {
                path: "$viewer"
            } },
            { $addFields: {
                isPostOwner: {
                    $cond: [
                        { $eq: ["$ownerDocID", "$viewerDocID"] },
                        true,
                        false
                    ]
                },
                interactionData: {
                    feedbackCount: "$feedbackCount",
                    upvoteCount: "$upvoteCount",
                    isSaved: {
                        $cond: [
                            { $in: ["$_id", "$viewer.saved_notes"] },
                            true,
                            false
                        ]
                    },
                }
            } },
            { $project: {
                content: 0,
                "owner._id": 0,
            } }
        ])
        
        if (post.length === 0) {
            return { ok: false, code: "NO_POST" }
        }
        
        const isPostUpvoted = await isUpvoted(post[0]?.["_id"]?.toString(), userDocID)
        const modifiedPost = { ...post[0], interactionData: { ...post[0]?.interactionData, isUpvoted: isPostUpvoted } }
        return { ok: true, post: modifiedPost }
    } catch (error) {
        return { ok: false, error: error, code: "SERVER" }
    }
}


export async function addSavePost({ studentDocID, noteDocID }) {
    try {
        await Students.updateOne(
            { _id: studentDocID },
            { $addToSet: { saved_notes: noteDocID } },
            { new: true }
        )

        return { ok: true }
    } catch (error) {
        return { ok: false }
    }
}

export async function deleteSavedPost({ studentDocID, noteDocID }) {
    try {
        await Students.updateOne(
            { _id: studentDocID },
            { $pull: { saved_notes: noteDocID } }
        )

        return { ok: true }
    } catch (error) {
        return { ok: false }
    }
}

export async function getSavedPosts(studentID: string) {
    try {
        let student = await Students.findOne({ studentID: studentID }, { saved_notes: 1 })
        let postsIDs = student.saved_notes
        let posts: SavedNoteObject[] = await Notes.aggregate([
            { $match: { _id: { $in: postsIDs } } },
            {
                $project: {
                    noteID: "$postID",
                    noteTitle: "$title",
                    noteThumbnail: { $first: '$content' },
                }
            }
        ])
        return { ok: true, posts }
    } catch (error) {
        return { ok: false }
    }
}


export async function searchPosts(searchTerm: string, options?: any) {
    try {
        const regex = new RegExp(searchTerm.split(' ').map(word => `(${word})`).join('.*'), 'i');
        const posts = await Notes.aggregate([
            { $match: { title: { $regex: regex }, type_: { $ne: "private" } } },
            {
                $project: {
                    postID: 1,
                    title: 1
                }
            }
        ])
        return { ok: true, posts: posts }
    } catch (error) {
        return { ok: false }
    }
}