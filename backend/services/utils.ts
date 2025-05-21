import fileUpload from "express-fileupload"
import sharp from "sharp"
import { upload } from "./firebase.service"
import slugify from "slugify"
import { v4 as uuidv4 } from "uuid"
import studentsModel from "../schemas/users.model"

export async function compressImage(fileObject: any) {
    try {
        let imageBuffer = fileObject.data
        let imageType: "jpeg" | "png" = fileObject.mimetype === "image/jpeg" ? "jpeg" : "png"
        let compressedBuffer = await sharp(imageBuffer)
        [imageType](
            imageType === "png"
                ? { quality: 70, compressionLevel: 9, adaptiveFiltering: true }
                : { quality: 70, progressive: true }
        ).toBuffer()

        return { ...fileObject, buffer: compressedBuffer, size: compressedBuffer.length }
    } catch (error) {
        return fileObject
    }
}


export async function processBulkCompressUpload(fileObjects: fileUpload.UploadedFile[], postID: string) {
    try {
        let compressedFiles = await Promise.all(fileObjects.map(fileObject => compressImage(fileObject)))
        let uploadedFiles = await Promise.all(compressedFiles.map(compressedFile => upload(compressedFile, `posts/${postID}/contents/${compressedFile["fileName"]}`)))
        return { ok: true, content: uploadedFiles }
    } catch (error) {
        return { ok: false, error: error }
    }
}

export async function processBuikPDFUpload(fileObjects: fileUpload.UploadedFile[], postID: string) {
    try {
        let files: { name: string, storageUrl: string }[] = []
        let failedUploads = []

        await Promise.all(fileObjects.map(async file => {
            const publicUrl = await upload(file, `posts/${postID}/contents/${file["fileName"]}`)
            if (publicUrl) {
                const name = file.name
                files.push({ name: name, storageUrl: publicUrl })
            } else {
                failedUploads.push(file.name)
            }
        }))

        return { ok: true, files: files, failedUploads: failedUploads }
    } catch (error) {
        return { ok: false, error: error }
    }
}


export function generateRandomUsername(displayname: string) {
    let sluggfied = slugify(displayname, {
        lower: true,
        strict: true
    })
    let uuid = uuidv4()
    let suffix = uuid.split("-")[0]
    let username = `${sluggfied}-${suffix}`

    return {
        userID: uuid,
        username: username
    }
}


export const userMentionMap = {
    mentionRegex: /(\@[\w+\-]+)/,
    usernameRegex: /\@([\w+\-]+)/,
    parseUsernamesFromText(normal_text: string): string[] {
        const usernames: string[] = []

        for (const text of normal_text.split(this.mentionRegex)) {
            if (text.match(this.mentionRegex)) {
                const username = text.match(this.usernameRegex)[1]
                usernames.push(username)
            }
        }

        return usernames
    },
    async tokenize(normal_text: string, usersModel: any): Promise<string> {
        try {
            const usernames: string[] = this.parseUsernamesFromText(normal_text)
            const users = usernames.length !== 0 && await usersModel.find({ username: { $in: usernames } }, { _id: 0, username: 1, displayname: 1, studentID: 1 })
            let tokanized = ""
        
            for (const text of normal_text.split(this.mentionRegex)) {
                if (text.match(this.mentionRegex)) {
                    const username = text.match(this.usernameRegex)[1]
                    const user = users.find(user => user.username === username) 
                    tokanized += (user ? `[[mention:${user.studentID}]]` : text)
                } else {
                    tokanized += text
                }
            }
        
            return tokanized
        } catch (error) {
            return normal_text
        }
    },

    async parse(tokenized: string, usersModel: any): Promise<string> {
        try {
            const mentionRegex = /\[\[mention\:([\w+\-]+)\]\]/g
            const userIDs = []
    
            for (const matches of tokenized.matchAll(mentionRegex)) {
                userIDs.push(matches[1])
            }
    
            const users = userIDs.length !== 0 ? await usersModel.find({ studentID: { $in: userIDs } }, { _id: 0, studentID: 1, username: 1, displayname: 1 }) : []
            return tokenized.replace(mentionRegex, (_, userID) => {
                const user = users.find(user => user.studentID === userID)
                return user ? `<a className='thread-mentioned-user' href='/user/${user.username}'>@${user.displayname}</a>` : `@${userID}`
            })
        } catch (error) {
            return tokenized
        }
    }
}
