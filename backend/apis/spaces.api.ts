import { Router } from "express";
import { Server } from "socket.io";
import { Convert } from "../services/user.service";
import logger from "../logger";
import sanitizeHtml from 'sanitize-html';
import { addRootSpace, addSubSpace, getRootSpace, getRootSpacesCount, getSubspacesCount } from "../services/spaces.service";

const router = Router();

export default function spacesApiRouter(io: Server) {
    router.post("/create", async (req, res) => {
        try {
            const studentID = req.session["stdid"];
            if (!studentID) return

            const { type, root_space_id } = req.query;

            // Validate space type
            if (!type || !['root', 'sub'].includes(type as string)) {
                logger.warn(`Invalid space type: ${type}`);
                return res.json({ ok: false, message: "Invalid space type. Must be 'root' or 'sub'" });
            }

            // Validate and sanitize title
            const title = sanitizeHtml(req.body.title || "").trim();
            if (!title || title.length < 3 || title.length > 100) {
                logger.warn(`Invalid title length: ${title?.length}`);
                return res.json({ ok: false, message: "Title must be between 3 and 100 characters" });
            }

            // Get and validate owner document
            const ownerDocID = await Convert.getDocumentID_studentid(studentID);
            if (!ownerDocID) {
                logger.error(`Failed to get owner document for studentID=${studentID}`);
                return res.json({ ok: false, message: "Internal server error" });
            }

            if (type === "root") {
                // Check if user has reached maximum root spaces limit
                const rootSpacesCount = await getRootSpacesCount(ownerDocID);
                if (rootSpacesCount.count >= 10) { // Assuming max 10 root spaces per user
                    logger.warn(`Root space limit reached for studentID=${studentID}`);
                    return res.json({ ok: false, message: "Maximum number of root spaces reached" });
                }

                const rootSpace = await addRootSpace({
                    title,
                    depth: 0,
                    ownerDocID
                });


                logger.info(`Created root space: ${title} by studentID=${studentID}`);
                return res.json({ ok: true, message: "Root space created" });
            }
            else if (type === "sub") {
                // Validate root space ID
                if (!root_space_id || typeof root_space_id !== 'string') {
                    logger.warn(`Missing or invalid root_space_id`);
                    return res.json({ ok: false, message: "Root space ID is required for subspaces" });
                }

                // Verify root space exists and belongs to user
                const rootSpace = await getRootSpace(root_space_id, ownerDocID);
                if (!rootSpace) {
                    logger.warn(`Unauthorized subspace creation attempt - root_space_id=${root_space_id}, studentID=${studentID}`);
                    return res.json({ ok: false, message: "Invalid root space or unauthorized" });
                }

                // Check if user has reached maximum subspaces limit for this root space
                const subspacesCount = await getSubspacesCount(root_space_id);
                if (subspacesCount.count >= 50) { // Assuming max 50 subspaces per root space
                    logger.warn(`Subspace limit reached for root_space_id=${root_space_id}`);
                    return res.json({ ok: false, message: "Maximum number of subspaces reached for this root space" });
                }

                const subspace = await addSubSpace({
                    title,
                    depth: 1,
                    ownerDocID,
                    parent_space_id: root_space_id
                });

                logger.info(`Created subspace: ${title} by studentID=${studentID} in root space=${root_space_id}`);
                return res.json({ ok: true, message: "Sub space created" });
            }
            else {
                return res.json({ ok: false, message: "Invalid space type" });
            }
        } catch (error) {
            logger.error(`Error creating space: ${error}`);
            return res.json({ ok: false, message: "Failed to create space" });
        }
    });

    return router;
}
