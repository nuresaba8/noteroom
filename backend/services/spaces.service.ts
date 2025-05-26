import { rootSpaceModel, subspaceModel, spaceModel } from "../schemas/spaces.model";
import studentsModel from "../schemas/users.model";

export async function addRootSpace(spaceData: any) {
    try {
        const space = await rootSpaceModel.create(spaceData)
        return { ok: true, space: space }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function getRootSpace(root_space_id: any, ownerDocID: any) {
    try {
        const data = await rootSpaceModel.findOne({
            _id: root_space_id,
            ownerDocID
        });
        return { ok: true, data: data }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function addSubSpace(spaceData: any) {
    try {
        const space = await subspaceModel.create(spaceData)
        return { ok: true, space: space }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function getSpace(space: any, ownerDocID: any) {
    try {
        const data = await spaceModel.findOne({
            _id: space,
            ownerDocID
        })
        return { ok: true, space: data }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function saveSpace(space: any, studentID: any, postID: any) {
    try {
        // Add post to saved_posts array
        const user = await studentsModel.findOne({ studentID });
        if (!user) {
            return { ok: false, message: "User not found" };
        }

        // Check if post is already saved in this space
        const existingSave = user.saved_posts.find(
            save => save.savedPostID.toString() === postID && save.space.toString() === space
        );

        if (existingSave) {
            return { ok: false, message: "Post already saved in this space" };
        }

        user.saved_posts.push({
            savedPostID: postID,
            space: space
        });

        await user.save();
        return { ok: true }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function getRootSpacesCount(ownerDocID: any) {
    try {
        const count = await rootSpaceModel.countDocuments({ ownerDocID });
        return { ok: true, count: count };
    } catch (error) {
        return { ok: false, error: error };
    }
}

export async function getSubspacesCount(rootSpaceId: string) {
    try {
        const count = await subspaceModel.countDocuments({ parent_space_id: rootSpaceId });
        return { ok: true, count: count };;
    } catch (error) {
        return { ok: false, error: error };
    }
}