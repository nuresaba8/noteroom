import { gql } from "@apollo/client"


const getPostByPostID = gql`
    query GetPost($postID: String!) {
        post(postID: $postID) {
            postID
            title
            description
            createdAt
            isPostOwner
            content(startIndex: 0) {
                resources
                totalContentCount
            }
            owner {
                profile_pic
                displayname
                username
            }
            interactionData {
                feedbackCount
                upvoteCount
                isSaved
                isUpvoted
            }
        }
    }
`


const getPostsByPage = gql`
    query GetPostBypage($page: Int!, $seed: Int!) {
        posts(page: $page, seed: $seed) {
            postID
            title
            description
            createdAt
            isPostOwner
            #TODO: in feed, now 2 pictures are being fetched. Maybe can have a reddit like feature to see all the pictures in feed
            content(startIndex: 0, count: 2) {
                resources
                totalContentCount
            }
            owner {
                profile_pic
                displayname
                username
            }
            interactionData {
                feedbackCount
                upvoteCount
                isSaved
                isUpvoted
            }
        }
    }
`

const getPostContentsByPostID = gql`
    query GetPostContentsByPostID($postID: String!) {
        post(postID: $postID) {
            content(startIndex: 0) {
                resources
                totalContentCount
            }
        }
    }
`

const getCommentsByPostID = gql`
    query GetCommentsByPostID($postID: String!) {
        comments(postID: $postID) {
            _id
            feedbackContents
            createdAt
            commenter {
                profile_pic
                username
                displayname
            }
            replies {
                feedbackContents
                parentFeedbackDocID
                createdAt
                replier {
                    profile_pic
                    username
                    displayname
                }
            }
        }
    }
`

const postCommentOnPost = gql`
    mutation PostComment($postID: String!, $feedbackContent: String!) {
        postComment(postID: $postID, feedbackContent: $feedbackContent) {
            _id
            feedbackContents
            createdAt
            commenter {
                profile_pic
                username
                displayname
            }
        }
    }
`

const postReplyOnComment = gql`
    mutation PostReplyOnComment($postID: String!, $feedbackContent: String!, $parentFeedbackDocID: String!) {
        postReply(postID: $postID, feedbackContent: $feedbackContent, parentFeedbackDocID: $parentFeedbackDocID) {
            _id
            feedbackContents
            createdAt
            replier {
                profile_pic
                username
                displayname
            }
        }
    }
`

export { getPostByPostID, getPostsByPage, getPostContentsByPostID, getCommentsByPostID, postCommentOnPost, postReplyOnComment }