import mongoose, { Schema, Document } from 'mongoose';

// Base Space Schema
const spaceSchema = new Schema({
    title: {
        type: String,
        required: true,
        trim: true
    },
    depth: {
        type: Number,
        required: true
    },
    ownerDocID: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'User'
    }
}, {
    discriminatorKey: 'type',
});

// Root Space Schema
const rootSpaceSchema = new Schema({});

// Subspace Schema
const subspaceSchema = new Schema({
    parent_space_id: {
        type: Schema.Types.ObjectId,
        required: true,
        ref: 'space'
    }
});

// Create the base model
const spaceModel = mongoose.model('space', spaceSchema);

// Create the discriminator models
const rootSpaceModel = spaceModel.discriminator('root', rootSpaceSchema);
const subspaceModel = spaceModel.discriminator('sub', subspaceSchema);

export { spaceModel, rootSpaceModel, subspaceModel }; 