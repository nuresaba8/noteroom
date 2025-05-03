import express from "express";
import { v4 as uuidv4 } from "uuid";
import { Router } from "express";
import { Server as SocketIOServer } from "socket.io";

// Dummy user data

const users = {
    alice: { studentID: "stu001" },
    bob: { studentID: "stu002" },
    charlie: { studentID: "stu003" },
    dave: { studentID: "stu004" },
};

type FriendRequest = {
    requestID: string;
    sender: string;
    receiver: string;
    status: "pending" | "accepted" | "declined";
    studentID: string; // sender's student ID
};

// In-memory friend request list
const friendRequests: FriendRequest[] = [];

// Simulated logged-in user
let loggedInUsername = "alice"; // You can replace this with real session user

export default function friendsApiRouter( io: SocketIOServer) {
    const router = Router();

    /**
     * Send a friend request
     * @route GET /api/friends/send/:username
     */
    router.get("/api/friends/send/:username", (req, res: any) => {
        const sender = loggedInUsername;
        const receiver = req.params.username;

        if (!users[receiver]) {
            return res.status(404).json({ ok: false, message: "Receiver not found" });
        }

        if (sender === receiver) {
            return res
                .status(400)
                .json({ ok: false, message: "Cannot send request to yourself" });
        }

        const alreadySent = friendRequests.some(
            (request) =>
                request.sender === sender &&
                request.receiver === receiver &&
                request.status === "pending"
        );

        if (alreadySent) {
            return res
                .status(409)
                .json({ ok: false, message: "Friend request already pending" });
        }

        const requestID = uuidv4();
        const newRequest: FriendRequest = {
            requestID,
            sender,
            receiver,
            status: "pending",
            studentID: users[sender].studentID,
        };

        friendRequests.push(newRequest);

        return res.status(200).json({
            ok: true,
            message: "Friend request sent",
            requestID,
            request: newRequest,
        });
    });

    /**
     * Accept a friend request
     * @route GET /api/friends/:requestID/accept
     */
    router.get("/api/friends/:requestID/accept", (req, res: any) => {
        const { requestID } = req.params;
        const receiver = loggedInUsername;

        const request = friendRequests.find(
            (r) => r.requestID === requestID && r.receiver === receiver
        );

        if (!request) {
            return res
                .status(404)
                .json({ ok: false, message: "Request not found or not authorized" });
        }

        if (request.status !== "pending") {
            return res
                .status(400)
                .json({
                    ok: false,
                    message: `Cannot accept. Already ${request.status}.`,
                });
        }

        request.status = "accepted";

        return res
            .status(200)
            .json({ ok: true, message: "Friend request accepted", request });
    });

    /**
     * Decline a friend request
     * @route GET /api/friends/:requestID/decline
     */
    router.get("/api/friends/:requestID/decline", (req, res: any) => {
        const { requestID } = req.params;
        const receiver = loggedInUsername;

        const request = friendRequests.find(
            (r) => r.requestID === requestID && r.receiver === receiver
        );

        if (!request) {
            return res
                .status(404)
                .json({ ok: false, message: "Request not found or not authorized" });
        }

        if (request.status !== "pending") {
            return res
                .status(400)
                .json({
                    ok: false,
                    message: `Cannot decline. Already ${request.status}.`,
                });
        }

        request.status = "declined";

        return res
            .status(200)
            .json({ ok: true, message: "Friend request declined", request });
    });

    //follow a user

    // Simulate in-memory/mock data

    let testUserDatabase = {
        receiver: {
            username: "john_doe",
            followers: ["u001", "u002"], // userIds following john_doe
        },
        sender: {
            userId: "u003",
            followings: [], // whom u003 is following
        },
    };

    // Follow API (GET method)
    router.get("/follow/:username", (req, res: any) => {
        const receiverUsername = req.params.username;
        const senderId =
            typeof req.query.senderId === "string" ? req.query.senderId : "u003"; // fallback default

        // Fetch test objects (simulated data)
        const receiver = testUserDatabase.receiver;
        const sender = testUserDatabase.sender;

        // Check if receiver exists
        if (receiver.username !== receiverUsername) {
            return res.status(404).json({ message: "Receiver not found." });
        }

        // Check if already followed (mock logic)
        const alreadyFollowing = receiver.followers.includes(senderId);

        if (alreadyFollowing) {
            return res
                .status(200)
                .json({ message: "Already following", followState: "following" });
        }

        // Simulate follow logic by updating mock objects
        receiver.followers.push(senderId);
        sender.followings.push(receiver.username);

        return res.status(200).json({
            message: `Follow request sent to ${receiver.username}`,
            followState: "following",
            testReceiverObject: receiver,
            testSenderObject: sender,
        });
    });
    return router;
}
