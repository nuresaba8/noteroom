import Follow from "../schemas/follow.model";
import Friends from "../schemas/friends.model";

export async function sendFriendRequest(request: any) {
    try {
        const existingRequest = await Friends.findOne({
            senderDocID: request.senderDocID,
            receiverDocID: request.receiverDocID
        });

        if (existingRequest) {
            return { ok: false };
        }

        await Friends.create(request);
        return { ok: true };
    } catch (error) {
        console.error("Error creating friend request:", error);
        return { ok: false, error };
    }
}


export async function getFriendRequestById(requestID: string) {
    try {
        const request = await Friends.findOne({ requestID: requestID });
        if (!request) return { ok: false };

        const receiver = await request.populate([
            { path: 'receiverDocID', select: 'studentID' },
        ])
        const receiverInfo = receiver["receiverDocID"]["studentID"]
        return { ok: true, request, receiverInfo };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

export async function updateFriendRequestStatus(requestID: string, status: 'accepted' | 'declined') {
    try {
        const result = await Friends.updateOne(
            { requestID },
            { $set: { status } }
        );

        if (result.modifiedCount > 0) {
            return { ok: true };
        } else {
            return { ok: false, error: 'No document was updated' };
        }
    } catch (error: any) {
        return { ok: false, error: error.message };
    }
}

export async function unfriendUser(requestID: string) {
    try {
        const result = await Friends.deleteOne({ requestID, status: "accepted" });
        if (result.deletedCount > 0) return { ok: true };
        return { ok: false, error: "No matching friendship found" };
    } catch (error) {
        return { ok: false, error: error.message };
    }
}

export async function followUser(followID: any, follower: any, following: any) {
    try {
        const followInfo = await Follow.findOne({
            followID: followID,
            followerDocID: follower,
            followingDocID: following
        });

        if (followInfo) return;

        const newFollow = await Follow.create({
            followID: followID,
            followerDocID: follower,
            followingDocID: following
        });
        return { ok: true };
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function unfollowUser(followerDocID: any, followingDocID: any ) {
    try {
        const followInfo = await Follow.findOne({ 
            followerDocID: followerDocID, 
            followingDocID: followingDocID 
        });
        if (followInfo) {
            await Follow.deleteOne({ followID: followInfo.followID });
            return { ok: true };
        }
        else {
            return { ok: false, message: "Not following this user." }
        }

    } catch (error) {
        return { ok: false, error };
    }
}


