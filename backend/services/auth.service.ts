import Students from "../schemas/users.model"
import { OAuth2Client } from "google-auth-library"

export async function verifyToken(client_id: string, id_token: string) {
    const client = new OAuth2Client(client_id)
    try {
        const ticket = await client.verifyIdToken({
            idToken: id_token,
            audience: client_id
        })
        return ticket.getPayload()
    } catch (error) {
        throw new Error(error)
    }
}


export async function getUserAuth(studentID_: string) {
    try {
        const authData = await Students.findOne({ studentID: studentID_ }, { studentID: 1, username: 1, _id: 0 })
        const { studentID, username } = authData
        return { ok: true, userAuth: { studentID, username } }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function getUserVarification(email: string) {
    try {
        let student = await Students.findOne({ email: email })
        if (student) {
            return {
                ok: true, data: {
                    studentPass: student["password"],
                    studentID: student["studentID"],
                    username: student["username"],
                    authProvider: student["authProvider"]
                }
            }
        } else {
            return { ok: false, code: "NO_EMAIL" }
        }
    } catch (error) {
        return { ok: false, code: "SERVER", error: error }
    }
}

export async function addUserProfile(user: any) {
    try {
        const userData = await Students.create(user)
        return { ok: true, data: userData }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function forgetPassword(email: any) {
    try {
        const user = await Students.findOne({ email: email })

        const resetToken = (user as any).generatePasswordResetToken();
        user.save({ validateBeforeSave: false })

        return { ok: true, resetToken, user }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function getUser(hashToken: any) {
    try {
        const user = await Students.findOne({
            passwordResetToken: hashToken,
            passwordResetExpires: { $gt: Date.now() }
        })
        return { ok: true, user }
    } catch (error) {
        return { ok: false, error: error }
    }
}
