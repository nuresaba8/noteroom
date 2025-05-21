import { Schema, model } from 'mongoose'
import { userMentionMap } from '../services/utils'
import studentsModel from './users.model'

const baseOptions = {
    discriminatorKey: 'docType',
    collection: 'comments'
}

const CommentsSchema = new Schema({
    noteDocID: { // The noteDocID on which the comment is given
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'posts'
    },
    feedbackContents: {
        type: String, 
        default: ""
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
}, baseOptions)

CommentsSchema.pre('save', async function(next) {
    try {
        if (this.feedbackContents && this.feedbackContents.trim().length !== 0) {
            const tokenize = await userMentionMap.tokenize(this.feedbackContents, studentsModel)
            this.feedbackContents = tokenize
        }
    } catch (error) {
        console.error(error)   
    } finally {
        next()
    }
})

CommentsSchema.post('aggregate', async function (docs) {
    try {
        for (const doc of docs) {
            if (doc.length !== 0) {
                const unparsedFeedbackText = doc.feedbackContents
                doc.feedbackContents = await userMentionMap.parse(unparsedFeedbackText, studentsModel)
            }
        }
    } catch (error) {
        console.error(error)
    }
})

const CommentsModel = model('comments', CommentsSchema)


const feedbackSchema = new Schema({
    commenterDocID: { // the user who gave the FEEDBACK
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'students'
    },
    replyCount: {
        type: Number,
        default: 0
    },
    upvoteCount: {
        type: Number,
        default: 0
    }
})
const feedbacksModel = CommentsModel.discriminator('feedbacks', feedbackSchema)


const replySchema = new Schema({
    commenterDocID: { // The user who gave the REPLY on a feedback
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'students'
    },
    parentFeedbackDocID: { // The comment section on which a reply is given. This is currently used to add a reply under a specific comment via the thread-id (thread-parentFeedbackDocID)
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'feedbacks'
    }
})
const replyModel = CommentsModel.discriminator('replies', replySchema)


export default CommentsModel
export {feedbacksModel, replyModel}