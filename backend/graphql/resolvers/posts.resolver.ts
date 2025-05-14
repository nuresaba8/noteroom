import notesModel from "../../schemas/posts.model"
import Posts from "../../schemas/posts.model"
import { addFeedback, addReply, getReplies } from "../../services/feedback.service"
import { Convert } from "../../services/user.service"

const PostsResolvers = {
    Post: {
        async content(parent, args: { startIndex: number, count: number | null }) {
            function Contents(sliced, content) {
                return {
                    resources: sliced,
                    returnedContentCount: sliced.length,
                    totalContentCount: content.length
                }
            }

            try {
                const postID = parent.postID
                const content = (await Posts.findOne({ postID: postID }, { content: 1 })).toObject()?.["content"]
                if (!content) {
                    return null
                }

                if (content.length === 0) {
                    return Contents([], [])
                }

                let sliced: string[]
                if (!args.startIndex && !args.count) {
                    sliced = content
                } else if (!args.count) {
                    sliced = content.slice(args.startIndex)
                } else {
                    sliced = content.slice(args.startIndex, args.count)
                }

                return Contents(sliced, content)
                
            } catch (error) {
                return Contents([], [])
            }
        },
    },
    Comment: {
        async replies(parent) {
            try {
                const parentFeedbackDocID = parent._id?.toString()
                const response = await getReplies(parentFeedbackDocID)
                if (response.ok) {
                    return response.replies
                }
            } catch (error) {
                return null
            }
        }
    },
    Mutation: {
        //TODO: trigger notification when commented or replied to relevant user
        async postComment(_, args: { postID: string, feedbackContent: string }, context) {
            try {
                const { req, res } = context
                const postDocID = (await notesModel.findOne({ postID: args.postID }, { _id: 1 }))._id
                const commenterDocID = (await Convert.getDocumentID_studentid(req.session["stdid"])).toString()
                const feedbackData = {
                    noteDocID: postDocID,
                    feedbackContents: args.feedbackContent,
                    commenterDocID: commenterDocID
                }
                const response = await addFeedback(feedbackData)
                if (response.ok) {
                    return response.feedback
                }
                return null
            } catch (error) {
                return null
            }
        },

        async postReply(_, args: { postID: string, feedbackContent: string, parentFeedbackDocID: string }, context) {
            try {
                const { req, res } = context
                const postDocID = (await notesModel.findOne({ postID: args.postID }, { _id: 1 }))._id
                const commenterDocID = (await Convert.getDocumentID_studentid(req.session["stdid"])).toString()

                const replyData = {
                    noteDocID: postDocID,
                    feedbackContents: args.feedbackContent,
                    commenterDocID: commenterDocID,
                    parentFeedbackDocID: args.parentFeedbackDocID
                }

                const response = await addReply(replyData)
                if (response.ok) {
                    return response.reply
                }
                return null
            } catch (error) {
                return null
            }
        }
    }
}

export default PostsResolvers