import { feedbacksModel as Comments, replyModel as Reply } from "../schemas/comments.model"
import { isCommentUpVoted } from "./vote.service"
import Notes from "../schemas/posts.model"
import mongoose from "mongoose"
import notesModel from "../schemas/posts.model"
import { userMentionMap } from "./utils"
import studentsModel from "../schemas/users.model"

//DEPRECATED
// export async function getComments({ noteDocID, studentDocID }) {
//     try {
//         let feedbacks = await Comments.find({ noteDocID: noteDocID }).populate('commenterDocID', 'displayname username studentID profile_pic').sort({ createdAt: -1 })
//         let _extentedFeedbacks = await Promise.all(
//             feedbacks.map(async feedback => {
//                 let isupvoted = await isCommentUpVoted({ feedbackDocID: feedback._id.toString(), voterStudentDocID: studentDocID })
//                 let reply = await Reply.find({ parentFeedbackDocID: feedback._id })
//                     .populate('commenterDocID', 'username displayname profile_pic studentID')

//                 return [{ ...feedback.toObject(), isUpVoted: isupvoted }, reply]
//             })
//         )
//         return { ok: true, comments: _extentedFeedbacks }
//     } catch (error) {
//         return { ok: false }
//     }
// }

export async function getComments(postID?: string, studentDocID?: string) {
    try {
        const postDocID = (await notesModel.findOne({ postID: postID }, { _id: 1 }))._id
        const comments = await Comments.aggregate([
            { $match: { noteDocID: new mongoose.Types.ObjectId(postDocID) } },
            {
                $lookup: {
                    from: 'students',
                    localField: 'commenterDocID',
                    foreignField: '_id',
                    as: 'commenter'
                }
            },
            {
                $unwind: {
                    path: '$commenter',
                }
            },
            {
                $project: {
                    feedbackContents: 1,
                    commenter: 1,
                    replyCount: 1, upvoteCount: 1,
                    createdAt: 1
                }
            }
        ])

        return { ok: true, comments: comments }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function getReplies(parentFeedbackDocID: string) {
    try {
        const replies = await Reply.aggregate([
            { $match: { parentFeedbackDocID: new mongoose.Types.ObjectId(parentFeedbackDocID) } },
            {
                $lookup: {
                    from: 'students',
                    localField: 'commenterDocID',
                    foreignField: '_id',
                    as: 'replier'
                }
            },
            {
                $unwind: {
                    path: '$replier',
                }
            },
            {
                $project: {
                    parentFeedbackDocID: 1,
                    feedbackContents: 1,
                    replier: 1,
                    createdAt: 1
                }
            }
        ])

        return { ok: true, replies }
    } catch (error) {
        return { ok: false, error }
    }
}


export async function addFeedback(feedbackData: any) {
    try {
        await Notes.findByIdAndUpdate(feedbackData.noteDocID, { $inc: { feedbackCount: 1 } })
        const feedbackDoc = await Comments.create(feedbackData)
        const feedbackContents = await userMentionMap.parse(feedbackDoc["feedbackContents"], studentsModel)
        const feedback = await Comments.findById(feedbackDoc._id)
            .populate('commenterDocID', 'displayname username studentID profile_pic')
            .populate({
                path: 'noteDocID',
                select: 'ownerDocID title postType',
                populate: {
                    path: 'ownerDocID',
                    select: 'studentID username'
                }
            })

        if (!feedback) return { ok: false }
        const extendedFeedback = { ...feedback.toObject(), feedbackContents, commenter: feedback?.["commenterDocID"],  }
        return { ok: true, feedback: extendedFeedback }
    } catch (error) {
        return { ok: false, error: error }
    }
}


export async function addReply(replyData: any) {
    try {
        await Notes.findByIdAndUpdate(replyData.noteDocID, { $inc: { feedbackCount: 1 } })
        await Comments.findByIdAndUpdate(replyData.parentFeedbackDocID, { $inc: { replyCount: 1 } })
        const replyDoc = await Reply.create(replyData)
        const replyContents = await userMentionMap.parse(replyDoc["feedbackContents"], studentsModel)
        const reply = await Reply.findById(replyDoc._id)
            .populate('commenterDocID', 'displayname username studentID profile_pic')
            .populate({
                path: 'parentFeedbackDocID',
                select: 'commenterDocID',
                populate: {
                    path: 'commenterDocID',
                    select: 'studentID username'
                }
            })
            .populate('noteDocID', 'title postType')

        const extentedReply = { ...reply.toObject(), feedbackContents: replyContents, replier: reply?.["commenterDocID"] }
        return { ok: true, reply: extentedReply }
    } catch (error) {
        return { ok: false }
    }
}
