import {
    browserLocalPersistence,
    browserSessionPersistence,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    setPersistence,
    updateProfile,
    type UserCredential,
    signInWithEmailAndPassword,
} from "firebase/auth";
import { doc, setDoc, Timestamp } from "firebase/firestore";

import { auth, db } from "./firebase_app";

export type SignUpInput = {
    email: string;
    password: string;
    displayName?: string;
    remember?: boolean; // if true: persist across browser restarts
};

export type LoginInput = {
    email: string;
    password: string;
    remember?: boolean; // if true: persist across browser restarts
};

export async function signUpWithEmail(
    input: SignUpInput
): Promise<UserCredential> {
    const remember = input.remember ?? true;

    await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
    );

    const cred = await createUserWithEmailAndPassword(
        auth,
        input.email,
        input.password
    );

    if (input.displayName) {
        await updateProfile(cred.user, { displayName: input.displayName });
    }

    await setDoc(doc(db, "users", cred.user.uid), {
        uid: cred.user.uid,
        email: cred.user.email ?? input.email,
        username: input.displayName ?? "",
        firstName: "",
        lastName: "",
        role: "admin",
        isVerified: cred.user.emailVerified,
        phoneNumber: "",
        hospital: "",
        profilePhotoUrl: cred.user.photoURL ?? "",
        createdAt: Timestamp.now(),
    });

    // verify email
    await sendEmailVerification(cred.user);

    return cred;
}

export async function loginWithEmail(input: LoginInput) {
    const remember = input.remember ?? true;

    await setPersistence(
        auth,
        remember ? browserLocalPersistence : browserSessionPersistence
    );

    const cred = await signInWithEmailAndPassword(
        auth,
        input.email,
        input.password
    );

    return cred;
}
