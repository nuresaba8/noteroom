import { createContext, ReactNode, useCallback, useContext, useEffect, useReducer, useRef, useState } from "react";
import feedReducer, { FeedActions } from "../reducers/feed.reducer";
import { useAppData } from "./appdata.context";
import Swal from "sweetalert2";
import withReactContent from "sweetalert2-react-content";
import downloadPostZip from "../utils/utils";
import { useGlobalComponentController } from "./globaldata.context";
import { PostType, UserProfilePost } from "../../../types/post.types";
import { useQuery } from "@apollo/client";
import { getPostsByPage } from "../../../backend/graphql/queries/posts.query"

const API_SERVER_URL = import.meta.env.VITE_API_SERVER_URL
const ReactSwal = withReactContent(Swal);

type FeedContextType = {
    feedNotes: PostType[],
    loading: boolean,
    lastNoteRef: (node: any) => void,
    dispatch: React.ActionDispatch<[actions: { type: FeedActions; payload?: any; }]>,
    FeedActions: any,
    controller: [
        (noteID: string, upvoteState: boolean) => Promise<{ ok: boolean, error?: any }>,
        ({ postID, title, content }: UserProfilePost, savedState: boolean) => Promise<{ ok: boolean }>,
        (folderName: string, postID: string, links?: string[]) => Promise<void>
    ]
}

export const FeedNoteContext = createContext<FeedContextType | null>(null)
export default function FeedNotesProvider({ children }: { children: ReactNode | ReactNode[] }) {
    const [feedNotes, dispatch] = useReducer(feedReducer, [])
    const [loading, setLodaing] = useState<boolean>(true)
    const [hasMore, setHasMore] = useState<boolean>(true)
    const { toast: [, setToast] } = useGlobalComponentController()!
    const { savedNotes: [, setSavedNotes] } = useAppData()!
    const [seed, setSeed] = useState<number>()
    const pageRef = useRef<number>(1)

    const { fetchMore } = useQuery(getPostsByPage, {
        variables: { page: pageRef.current, seed },
        onCompleted: (data) => {
            setLodaing(false)
            if (data && data.posts && data.posts.length !== 0) {
                const { posts } = data
                dispatch({ type: FeedActions.ADD_NOTES, payload: { notes: posts } })
            } else {
                setHasMore(false)
            }
        },
        onError: (error) => {
            console.log(error)
        }
    })

    const observer = useRef<IntersectionObserver | null>(null)

    const lastNoteRef = useCallback((node: any) => {
        if (loading) return
        if (observer.current) observer.current.disconnect()

        observer.current = new IntersectionObserver(async (entries: IntersectionObserverEntry[]) => {
            if (entries[0].isIntersecting && hasMore) {
                setLodaing(true)
                pageRef.current = pageRef.current + 1
                await fetchMore({ variables: { page: pageRef.current, seed } })
            }
        })

        if (node) observer.current.observe(node)
    }, [loading, hasMore, fetchMore])

    async function upvoteNote(noteID: string, upvoteState: boolean) {
        try {
            dispatch({ type: FeedActions.TOGGLE_UPVOTE_NOTE, payload: { noteID: noteID } })
            let response = await fetch(`${API_SERVER_URL}/api/posts/${noteID}/vote?type=upvote${upvoteState ? '&action=delete' : ''}`, {
                method: "post",
                credentials: "include"
            })
            if (response.ok) {
                let data = await response.json()
                return { ok: data.ok }
            } else {
                return { ok: false }
            }
        } catch (error) {
            return { ok: true, error: error }
        }
    }
    async function saveNote({ postID, title, content }: UserProfilePost, savedState: boolean) {
        try {
            dispatch({ type: FeedActions.TOGGLE_SAVE_NOTE, payload: { noteID: postID } })
            setSavedNotes((prev: any) => {
                if (savedState) {
                    return prev.filter((note: UserProfilePost) => note.postID !== postID)
                } else {
                    return [...prev, { postID, title, content }]
                }
            })

            let response = await fetch(`${API_SERVER_URL}/api/posts/${postID}/save?action=${savedState ? 'delete' : 'save'}`, {
                method: 'put',
                credentials: "include"
            })
            if (response.ok) {
                let data = await response.json()
                if (data.ok) {
                    setToast({ show: true, data: { message: savedState ? "Removed from saved" : "Post saved" } })
                }
                return { ok: true }
            } else {
                return { ok: false }
            }
        } catch (error) {
            return { ok: false }
        }
    }

    async function download(folderName: string, postID: string, links?: string[]) {
        try {
            ReactSwal.fire({
                title: "Preparing Download",
                text: "Please wait while we generate the ZIP...",
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    ReactSwal.showLoading();
                }
            });
            const imageUrls: string[] = links ? links : []
            if (!links) {
                const imageResponse = await fetch(`${API_SERVER_URL}/api/posts/${postID}/images`, { credentials: "include" })
                if (imageResponse.ok) {
                    const data = await imageResponse.json()
                    if (data.ok && data.images && data.images.length !== 0) {
                        imageUrls.push(...data.images)
                    }
                }
            }

            if (imageUrls.length !== 0) {
                const success = await downloadPostZip(folderName, imageUrls);
                ReactSwal.close();

                if (success) {
                    setToast({ show: true, data: { message: "Downloading Post" } })
                } else {
                    throw new Error("Failed to create ZIP");
                }
            }
        } catch (error) {
            console.error(error)
        }
    }

    useEffect(() => {
        const now = new Date();
        const baseSeed = Math.floor(now.getTime());
        const salt = now.getMinutes() * 31 + now.getSeconds(); 
        const seed = ((baseSeed + salt) * 104729) % 999999937;
        setSeed(seed)
    }, [])

    return (
        <FeedNoteContext.Provider value={{ feedNotes, loading, lastNoteRef, dispatch, FeedActions, controller: [upvoteNote, saveNote, download] }}>
            {children}
        </FeedNoteContext.Provider>
    )
}

export function useFeed() {
    let context = useContext(FeedNoteContext)
    return context
}