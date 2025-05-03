import { Schema, model } from "mongoose";

const friendsSchema = new Schema({
    senderDocID: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'students'
    },
    receiverDocID: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'students'
    },
    requestID: {
        type: String,
        required: true,
    },
    status: {
        type: String,
        enum: ["pending", "accepted", "declined"],
        default: "pending",
    }
});

const friendsModel = model("friends", friendsSchema);
export default friendsModel;
