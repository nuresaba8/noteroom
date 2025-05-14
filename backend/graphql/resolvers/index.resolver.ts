import { mergeResolvers } from "@graphql-tools/merge"
import Users from "../../schemas/users.model"
import UserResolver from "./users.resolver"
import PostsResolvers from "./posts.resolver"
import StringOrIntScalarType from "../scalars/types.scalar"
import { getComments } from "../../services/feedback.service"
import { getNotifications } from "../../services/notification.service"
import { Convert } from "../../services/user.service"
import { getConnections } from '../../services/friends.service';
import { getPosts, getSinglePost } from "../../services/post.service"

const RootQueryResolver = {
    StringOrInt: StringOrIntScalarType,

    Query: {
        async user(_, args: { username: string }) {
            const user = (await Users.findOne({ username: args.username })).toObject()
            return user
        },

        async post(_, args: { postID: string }, context) {
            try {
                const { req, res } = context
                const userDocID = (await Convert.getDocumentID_studentid(req.session?.["mstdid"] || req.session?.["stdid"])).toString()
                const response = await getSinglePost(args.postID, userDocID)
                if (response.ok) {
                    return response.post
                }
                return null
            } catch (error) {
                return null
            }
        },

        async posts(_, args: { page: number, seed: number }, context) {
            try {
                const { req, res } = context
                const userDocID = (await Convert.getDocumentID_studentid(req.session?.["mstdid"] || req.session?.["stdid"])).toString()
                const limit = 7
                const skip: number = (args.page - 1) * limit
                const response = await getPosts(userDocID, { limit, skip, seed: args.seed })
                if (response.ok) {
                    return response.posts
                }
                return null
            } catch (error) {
                return null
            }
        },

        async comments(_, args: { postID: string }) {
            try {
                const response = await getComments(args.postID)
                if (response.ok) {
                    return response.comments
                }
                return null
            } catch (error) {
                return null
            }
        },

        async notifications(_, __, context) {
            try {
                const { req, res } = context
                const ownerStudentID = req.session?.["stdid"]
                const response = await getNotifications(ownerStudentID)
                if (response.ok) {
                    return response.notifications
                }
                return null
            } catch (error) {
                return null
            }
        },

        async connections(_, args: { status: "follower" | "following" }, context) {
            try {
                const { req, res } = context
                const receiverDocID = (await Convert.getDocumentID_studentid(req.session["mstdid"] || req.session["stdid"]))?.toString()
                const response = await getConnections(receiverDocID, args.status)
                if (response.ok) {
                    return response.requests
                }
                return null
            } catch (error) {
                return null
            }
        }
    }
}

export default mergeResolvers([RootQueryResolver, UserResolver, PostsResolvers])