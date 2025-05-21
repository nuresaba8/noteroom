import { Router } from "express";
import { Server } from "socket.io";
import { Convert, getMutualCollegeStudents, getProfile, updateProfileFields } from "../services/user.service";
import sanitizeHtml from 'sanitize-html';
import logger from "../logger";
import validator from "validator";

const router = Router()
export const ALLOWED_CHANGEABLE_FIELDS = [
	"username",
	"displayname",
	"bio",
	"rollnumber",
	"favouritesubject",
	"notfavsubject",
	"group",
	"collegeyear"
]

function isValidUsername(username: string): boolean {
	// Must be at least 4 characters
	if (username.length < 4) return false;

	// Must be all ASCII characters
	if (!validator.isAscii(username)) return false;

	// Only allow letters, digits, ., _, -, but not at the start or end
	// Start and end must be alphanumeric
	const regex = /^[a-zA-Z0-9](?:[a-zA-Z0-9._-]*[a-zA-Z0-9])?$/;
	return regex.test(username);
}


export default function profileApiRouter(io: Server) {
	router.get("/mutual-college", async (req, res) => {
		try {
			let studentID = req.session["stdid"]
			let studentDocID = (await Convert.getDocumentID_studentid(studentID)).toString()
			let countDoc = req.query.countdoc ? true : false

			let batch = Number(req.query.batch || "1")
			let count = 15
			let skip = (batch - 1) * count

			let profiles = await getMutualCollegeStudents(studentDocID, { count: count, skip: skip, countDoc })
			res.json(profiles)
		} catch (error) {
			res.json([])
		}
	})

	//DEPRECATED
	router.get("/:username", async (req, res) => {
		try {
			if (req.params.username) {
				let username = req.params.username

				let visiterStudentID = req.session["stdid"]
				let profileStudentID = await Convert.getStudentID_username(username)

				let profile = await getProfile(username)
				// if (profile.ok) {
				//     res.json({ ok: true, profile: {...profile.student, owner: visiterStudentID === profileStudentID } })
				// } else {
				//     //TODO: handle invalid profile url
				//     res.json({ ok: false, message: "Sorry, nobody on NoteRoom goes by that name." })
				// }
			} else {
				//TODO: handle 404, generally
				res.json({ ok: false, message: "Page not found!" })
			}
		} catch (error) {
			res.json({ ok: false })
		}
	});

	router.post("/change", async (req, res: any) => {
		try {
			const studentID = req.session["stdid"];
			if (!studentID) return;

			const group = req.body.group?.trim();
			if (group) {
				if (!["Science", "Commerce", "Arts"].includes(group)) {
					logger.warn(`Invalid or missing group for student ${studentID}: ${group}`);
					return res.json({ ok: false, message: "Invalid or missing group." });
				}

			}

			const updates: Record<string, string> = {};

			for (const key in req.body) {
				const rawValue = req.body[key];
				const value = sanitizeHtml(rawValue || "").trim();

				if (!ALLOWED_CHANGEABLE_FIELDS.includes(key)) {
					logger.warn(`Unauthorized change attempt on field: ${key} by student ${studentID}`);
					return res.json({ ok: false, message: `Field "${key}" is not allowed to be changed.` });
				}

				if (!value) {
					logger.warn(`Empty value submitted for "${key}" by student ${studentID}`);
					return res.json({ ok: false, message: `Value for "${key}" cannot be empty.` });
				}

				if (key === "username" && !isValidUsername(value)) {
					logger.warn(`Invalid username attempt by student ${studentID}: "${value}"`);
					return res.json({
						ok: false,
						message:
							"Invalid username. Use only letters, numbers, dot (.), underscore (_) or dash (-). It must be at least 4 characters long and cannot start or end with punctuation."
					});
				}


				updates[key] = value;
			}

			if (Object.keys(updates).length === 0) {
				return res.json({ ok: false, message: "No valid changes provided." });
			}

			const response = await updateProfileFields(studentID, updates);

			if (response.ok) {
				logger.info(`Profile updated successfully for student ${studentID}`);
				res.json({ ok: true });
			} else {
				logger.error(`Update failed for student ${studentID}`);
				res.json({ ok: false, message: "Can't change your profile details now! Please try again a bit later" });
			}
		} catch (error) {
			logger.error(`Exception occurred during profile change: ${error}`);
			res.json({ ok: false, message: "An error occurred while updating profile." });
		}
	});



	return router
}
