import { Schema, model } from "mongoose";

const followSchema = new Schema({
    followID: {
        type: String,
        unique: true,
        required: true,
    },
    followerDocID: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "students",
    },
    followingDocID: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: "students",
    },
});

const followModel = model("follows", followSchema);

export default followModel;
