import { Schema, model } from 'mongoose'
import crypto from 'crypto'

const studentsSchema = new Schema({
    profile_pic: {
        type: String,
        default: null
    },
    displayname: {
        type: String,
        validate: {
            validator: (displayname) => displayname !== "",
            message: "Displayname is not provided"
        }
    },
    email: {
        type: String,
        validate: [
            {
                validator: (email) => email != "",
                message: "Email is not provided"
            },
            {
                validator: (email: any) => email.includes("@"),
                message: `The email addess is not valid`
            },
        ],
        unique: true,
    },
    password: {
        type: Schema.Types.Mixed,
        validate: {
            validator: (password) => password !== "",
            message: "Password is not provided"
        }
    },
    studentID: {
        type: String,
        required: true,
        immutable: true,
        unique: true
    },
    rollnumber: {
        type: String,
        default: "Not given"
    },
    collegesection: {
        type: String,
        default: "Not selected"
    },
    collegeyear: {
        type: String,
        default: "Not Selected"
    },
    authProvider: {
        type: String,
        default: null
    },
    bio: {
        type: String,
        minLength: 0,
        maxLength: 300,
        default: "Just a student surviving on caffeine, last-minute deadlines, and the hope that 'Ctrl + Z' works in real life."
    },
    favouritesubject: {
        type: String,
        default: "Not selected"
    },
    notfavsubject: {
        type: String,
        default: "Not selected"
    },
    group: {
        type: String,
        default: "Not given"
    },
    username: {
        type: String,
        unique: true,
        required: true
    },
    visibility: {
        type: String,
        default: "public"
    },
    owned_notes: {
        type: [Schema.Types.ObjectId],
        ref: 'posts',
        default: []
    },
    owned_posts: {
        type: [Schema.Types.ObjectId],
        ref: 'posts',
        default: []
    },
    saved_notes: {
        type: [Schema.Types.ObjectId],
        ref: 'posts',
        default: []
    },
    featured_notes: {
        type: [Schema.Types.ObjectId],
        ref: 'posts',
        default: []
    },
    downloaded_notes: {
        type: [Schema.Types.ObjectId],
        ref: 'posts',
        default: []
    },
    badges: {
        type: [Number],
        default: [0],
        unique: false
    },
    district: {
        type: String,
        default: ""
    },
    collegeID: {
        type: Schema.Types.Mixed, //* Either the college name (custom one) or the college ID (pre-defined one)
        default: "Not Given",
    },
    onboarded: {
        type: Boolean,
        default: false
    },
    socials: {
        type: new Schema({
            instagram: {
                link: { type: String, default: null }
            },
            facebook: {
                link: { type: String, default: null }
            },
            linkedin: {
                link: { type: String, default: null }
            },
            github: {
                link: { type: String, default: null }
            },
            twitter: {
                link: { type: String, default: null }
            },
            website: {
                link: { type: String, default: null }
            }
        }, { _id: false }),
        default: () => ({
            instagram: { link: null },
            facebook: { link: null },
            linkedin: { link: null },
            github: { link: null },
            twitter: { link: null },
            website: { link: null }
        })
    },
    passwordResetToken: String,
    passwordResetExpires: Date
})

studentsSchema.methods.generatePasswordResetToken = function () {
    const resetToken = crypto.randomBytes(20).toString('hex');

    this.passwordResetToken = crypto.createHash("sha256").update(resetToken).digest('hex');
    this.passwordResetExpires = new Date(Date.now() + 10 * 60 * 1000);

    return resetToken;
}


const studentsModel = model('students', studentsSchema)

export default studentsModel