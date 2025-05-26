import { Router } from "express";
import { Server } from "socket.io";
import { getSinglePost, addSavePost, deleteSavedPost, getSavedPosts } from "../services/post.service";
import { addFeedback, addReply } from "../services/feedback.service";
import { addVote, deleteVote } from "../services/vote.service";
import { Convert } from "../services/user.service";
import { NotificationEvent, NotificationSender } from "../services/notification.service";
import notesModel from "../schemas/posts.model";
import { getSpace, saveSpace } from "../services/spaces.service";
import logger from "../logger";
import rateLimit from 'express-rate-limit';

const router = Router()
export default function postApiRouter(io: Server) {
    router.use(rateLimit({
        windowMs: 15 * 60 * 1000, // 15 minutes
        max: 100, // Limit each IP to 100 requests per windowMs
        message: { ok: false, message: 'Too many requests, please try again later.' }
    }))
    //TODO: vote should send notifications

    //DEPRECATED
    router.get("/:postID/metadata", async (req, res) => {
        try {
            const studentID = req.session["stdid"]
            const studentDocID = (await Convert.getDocumentID_studentid(studentID)).toString()
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            // const response: any = await getSinglePost(postDocID, studentDocID, { images: false })
            // if (response.ok) {
            //     res.json({ ok: true, noteData: response.noteData })
            // } else {
            //     res.json({ ok: false })
            // }
        } catch (error) {
            console.error(error)
            res.json({ ok: false })
        }
    })

    //DEPRECATED
    router.get("/:postID/images", async (req, res) => {
        try {
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            // const response: any = await getSinglePost(postDocID, null, { images: true })
            // if (response.ok) {
            //     res.json({ ok: true, images: response.images })
            // } else {
            //     res.json({ ok: false })
            // }
        } catch (error) {
            res.json({ ok: false })
        }
    })

    //DEPRECATED
    router.get("/:postID/comments", async (req, res) => {
        try {
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            const studentDocID = (await Convert.getDocumentID_studentid(req.session["stdid"])).toString()
            // const response = await getComments({ noteDocID: postDocID, studentDocID })
            // if (response.ok) {
            //     res.json({ ok: true, comments: response.comments })
            // } else {
            //     res.json({ ok: false })
            // }
        } catch (error) {
            res.json({ ok: false })
        }
    })

    router.put("/:postID/save", async (req, res) => {
        try {
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            const action = <"save" | "delete">req.query["action"]
            const studentDocID = (await Convert.getDocumentID_studentid(req.session["stdid"])).toString()

            if (action === 'save') {
                let response = await addSavePost({ studentDocID, noteDocID: postDocID })
                res.json({ ok: response.ok })
            } else {
                let response = await deleteSavedPost({ studentDocID, noteDocID: postDocID })
                res.json({ ok: response.ok })
            }
        } catch (error) {
            res.json({ ok: false })
        }
    })

    //DEPRECATED: only the notification system needs to be implemented
    router.post("/:postID/feedbacks", async (req, res) => {
        try {
            const postID = req.params.postID
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            const studentID = req.session["stdid"]
            const feedbackContent = req.body.feedbackContent
            const commenterDocID = (await Convert.getDocumentID_studentid(studentID)).toString()

            const feedbackData = {
                noteDocID: postDocID,
                commenterDocID: commenterDocID,
                feedbackContents: feedbackContent
            }
            const response = await addFeedback(feedbackData)
            if (response.ok) {
                const { feedback } = response

                const toStudentID = feedback["noteDocID"]["ownerDocID"]["studentID"];
                const fromStudentID = feedback["commenterDocID"]["studentID"]

                if (toStudentID !== fromStudentID) {
                    await NotificationSender(io, {
                        ownerStudentID: toStudentID,
                        redirectTo: `/post/${postID}`
                    }).sendNotification({
                        content: `gave you a comment on "${feedback["noteDocID"]["title"]}". Check it out!`,
                        event: NotificationEvent.NOTIF_COMMENT,
                        isInteraction: true,
                        fromUserSudentDocID: feedback["commenterDocID"]["_id"]
                    })
                }
                res.json({ ok: true, feedback: feedback })
            } else {
                res.json({ ok: false })
            }
        } catch (error) {
            console.error(error)
            res.json({ ok: false })
        }
    })

    router.post("/:postID/feedbacks/:feedbackID/vote", async (req, res) => {
        try {
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            const feedbackID = req.params.feedbackID
            const voterStudentDocID = await Convert.getDocumentID_studentid(req.session["stdid"])
            const voteType = <"upvote" | "downvote">req.query["type"]
            if (voteType === "upvote") {
                const response = await addVote({ voteType, noteDocID: postDocID, voterStudentDocID: voterStudentDocID }, "comment", feedbackID)
                res.json({ ok: response.ok })
            } else {
                const response = await deleteVote({ noteDocID: postDocID, voterStudentDocID }, "comment", feedbackID)
                res.json({ ok: response.ok })
            }
        } catch (error) {
            res.json({ ok: false })
        }
    })

    //DEPRECATED: only the notification system needs to be implemented
    router.post("/:postID/feedbacks/:feedbackID/replies", async (req, res) => {
        try {
            const postID = req.params.postID
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            const studentID = req.session["stdid"]
            const replyContent = req.body.replyContent
            const parentFeedbackDocID = req.params.feedbackID
            const replyToUsername = req.body.replyToUsername
            const replierDocID = (await Convert.getDocumentID_studentid(studentID)).toString()

            const replyData = {
                noteDocID: postDocID,
                feedbackContents: replyContent,
                commenterDocID: replierDocID,
                parentFeedbackDocID: parentFeedbackDocID
            }
            const response = await addReply(replyData)
            if (response.ok) {
                const { reply } = response

                const toStudentID = await Convert.getStudentID_username(replyToUsername)
                const fromStudentID = reply["commenterDocID"]["studentID"]

                if (toStudentID !== fromStudentID) {
                    await NotificationSender(io, {
                        ownerStudentID: toStudentID,
                        redirectTo: `/post/${postID}`
                    }).sendNotification({
                        content: `gave a reply on your comment on "${reply["noteDocID"]["title"]}". Check it out!`,
                        event: NotificationEvent.NOTIF_COMMENT,
                        isInteraction: true,
                        fromUserSudentDocID: reply["commenterDocID"]["_id"]
                    })
                }

                res.json({ ok: true, reply: response.reply })
            } else {
                res.json({ ok: false })
            }
        } catch (error) {
            res.json({ ok: true })
        }
    })

    router.post("/:postID/vote", async (req, res) => {
        try {
            const postDocID = (await notesModel.findOne({ postID: req.params.postID }, { _id: 1 }))._id.toString()
            const action = req.query["action"]
            const voterStudentID = req.session["stdid"]
            const voterStudentDocID = (await Convert.getDocumentID_studentid(voterStudentID)).toString()
            const voteType = <"upvote" | "downvote">req.query["type"]

            if (!action) {
                let response = await addVote({ voteType, noteDocID: postDocID, voterStudentDocID: voterStudentDocID }, "post")
                res.json({ ok: response.ok })
            } else {
                let response = await deleteVote({ noteDocID: postDocID, voterStudentDocID }, "post")
                res.json({ ok: response.ok })
            }

        } catch (error) {
            res.json({ ok: false })
        }
    })

    //DEPRECATED
    router.get("/saved", async (req, res) => {
        try {
            const studentID = req.session["stdid"]
            const response = await getSavedPosts(studentID)
            if (response.ok) {
                res.json({ ok: true, posts: response.posts })
            } else {
                res.json({ ok: false })
            }
        } catch (error) {
            res.json({ ok: false })
        }
    })

    router.get("/save/:postID", async (req, res) => {
        try {
            const studentID = req.session?.["stdid"];
            if (!studentID) return

            const { postID } = req.params;
            const { space } = req.query;

            // Input validation
            if (!postID) {
                logger.warn(`Invalid postID format: ${postID}`);
                return res.json({ ok: false, message: "Invalid post ID format" });
            }

            if (!space || typeof space !== 'string') {
                logger.warn(`Missing or invalid space parameter`);
                return res.json({ ok: false, message: "Space ID is required and must be a string" });
            }

            // Get and validate owner document
            const ownerDocID = await Convert.getDocumentID_studentid(studentID);
            if (!ownerDocID) {
                logger.error(`Failed to get owner document for studentID=${studentID}`);
                return res.json({ ok: false, message: "Internal server error" });
            }

            // Verify space exists and belongs to user
            const spaceDoc = await getSpace(space, ownerDocID);
            if (!spaceDoc) {
                logger.warn(`Unauthorized space access attempt - space=${space}, studentID=${studentID}`);
                return res.json({ ok: false, message: "Invalid space or unauthorized" });
            }

            // Attempt to save
            const result = await saveSpace(space, studentID, postID);
            if (!result) {
                logger.error(`Save operation failed for postID=${postID}, space=${space}`);
                return res.json({ ok: false, message: "Failed to save post to space" });
            }

            logger.info(`Saved post ${postID} to space ${space} by studentID=${studentID}`);
            return res.json({ ok: true });
        } catch (error) {
            logger.error(`Error saving post to space: ${error}`);
            return res.json({ ok: false, message: "Failed to save post to space" });
        }
    });

    return router
}
