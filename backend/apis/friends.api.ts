import { Router } from "express";
import { Server } from "socket.io";
import rateLimit from "express-rate-limit";
import logger from "../logger";
import {
    sendFriendRequest,
    getFriendRequestById,
    updateFriendRequestStatus,
    unfriendUser,
    followUser,
    unfollowUser,
} from "../services/friends.service";
import { Convert } from "../services/user.service";
import { v4 as uuidv4, validate as isUUID } from "uuid";

const router = Router();

export default function friendsApiRouter(io: Server) {
    router.use(
        rateLimit({
            windowMs: 15 * 60 * 1000,
            max: 10,
            message: "Too many friend request actions. Please try again later.",
        })
    );

    const getUserIDs = async (studentID: string, username: string) => {
        const sender = await Convert.getDocumentID_studentid(studentID);
        const receiver = await Convert.getDocumentID_username(username);
        return { sender, receiver };
    };

    const logAndRespond = (res, level, message, meta = {}) => {
        logger[level](message, meta);
        return res.json({ ok: false, message });
    };

    router.get("/send/:username", async (req, res) => {
        const senderID = req.session?.["stdid"];
        const receiverUsername = req.params.username;

        if (!senderID) return

        try {
            const senderUsername = await Convert.getUserName_studentid(senderID);
            if (!senderUsername)
                return logAndRespond(res, "error", "Invalid sender username", { senderID });

            if (senderUsername === receiverUsername)
                return logAndRespond(res, "warn", "Cannot send request to yourself");

            const { sender, receiver } = await getUserIDs(senderID, receiverUsername);

            if (!sender || !receiver)
                return logAndRespond(res, "error", "Invalid sender or receiver", {
                    senderID,
                    receiverUsername,
                });

            const requestID = uuidv4();
            const result = await sendFriendRequest({
                senderDocID: sender,
                receiverDocID: receiver,
                requestID,
                status: "pending",
            });

            if (!result.ok)
                return logAndRespond(res, "error", "Failed to send friend request", result);

            logger.info("Friend request sent", { from: sender, to: receiverUsername });
            return res.status(200).json({ ok: true, message: "Friend request sent", requestID });
        } catch (err) {
            return logAndRespond(res, "error", "Internal error sending friend request", { err });
        }
    });

    router.get("/:requestID", async (req, res) => {
        const studentID = req.session?.["stdid"];
        const { requestID } = req.params;
        const action = req.query.action as string;

        if (!studentID) return

        if (!isUUID(requestID))
            return logAndRespond(res, "warn", "Invalid request ID format", { requestID });

        try {
            const currentUser = await Convert.getDocumentID_studentid(studentID);
            if (!currentUser) return logAndRespond(res, "warn", "Student not found", { studentID });

            const { ok, request, receiverInfo } = await getFriendRequestById(requestID);
            if (!ok || !request) return logAndRespond(res, "warn", "Request not found", { requestID });

            const isParticipant =
                request.senderDocID._id.toString() === currentUser.toString() ||
                request.receiverDocID._id.toString() === currentUser.toString();

            if (["accept", "decline"].includes(action)) {
                if (receiverInfo !== studentID)
                    return logAndRespond(res, "warn", "Unauthorized to respond to request", { studentID });

                if (request.status !== "pending")
                    return logAndRespond(res, "info", `Cannot ${action}. Already ${request.status}`);

                const updateResult = await updateFriendRequestStatus(
                    requestID,
                    action === "accept" ? "accepted" : "declined"
                );
                if (!updateResult.ok)
                    return logAndRespond(res, "error", `Failed to ${action}`, updateResult);

                logger.info(`Friend request ${action}ed`, { requestID, studentID });
                return res.status(200).json({ ok: true, message: `Request ${action}d` });
            }

            if (action === "unfriend") {
                if (request.status !== "accepted")
                    return logAndRespond(res, "info", "Users are not friends yet");

                if (!isParticipant)
                    return logAndRespond(res, "warn", "Not part of this friendship", {
                        requestID,
                        currentUser,
                    });

                const unfriendResult = await unfriendUser(requestID);
                if (!unfriendResult.ok)
                    return logAndRespond(res, "error", "Failed to unfriend", unfriendResult);

                logger.info("Unfriended successfully", { requestID, currentUser });
                return res.status(200).json({ ok: true, message: "Unfriended successfully" });
            }

            return logAndRespond(res, "warn", "Invalid action parameter", { action });
        } catch (err) {
            return logAndRespond(res, "error", "Unexpected error", { requestID, err });
        }
    });

    router.get("/follow/:username", async (req, res) => {
        const action = req.query.action;
        const studentID = req.session?.["stdid"];
        const receiverUsername = req.params.username;

        if (!studentID) return

        try {
            const { sender, receiver } = await getUserIDs(studentID, receiverUsername);

            if (!sender || !receiver)
                return logAndRespond(res, "warn", "Student not found", { sender, receiver });

            if (sender.toString() === receiver.toString())
                return logAndRespond(res, "warn", "Cannot follow/unfollow yourself");

            if (action === "follow") {
                const followID = uuidv4();
                const result = await followUser(followID, sender, receiver);
                if (!result.ok) return logAndRespond(res, "error", "Failed to follow", result);

                logger.info("Followed successfully", { sender, receiver });
                return res.status(200).json({ ok: true, message: `Now following ${receiverUsername}` });
            }

            if (action === "unfollow") {
                const result = await unfollowUser(sender, receiver);
                if (!result.ok) return logAndRespond(res, "error", "Failed to unfollow", result);

                logger.info("Unfollowed successfully", { sender, receiver });
                return res.status(200).json({ ok: true, message: `Unfollowed ${receiverUsername}` });
            }

            return logAndRespond(res, "warn", "Invalid action", { action });
        } catch (err) {
            return logAndRespond(res, "error", "Unexpected follow error", { studentID, err });
        }
    });

    return router;
}
