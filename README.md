# Sunday Circle

Elders Quorum bulletin, General Conference talk, lesson, and class thoughts.

Live: https://guileless-stroopwafel-b7a3f0.netlify.app/  
Repo: https://github.com/windbmills/sunday-circle

Quorum members do not download an app. They open the link (or scan the Admin QR) and can Add to Home Screen.

## Who can do what

- Anyone with the link can read the bulletin and lesson.
- Anyone can post a thought (Firebase signs them in anonymously in the background).
- The owner (`windmills34@gmail.com`) and approved editors publish Cover/Lesson and moderate thoughts.
- Only the owner can approve or remove editor emails.

There are no public PINs or shared passwords in `config.js`. Editors use their own email and password through Firebase Authentication.

## Owner first-time setup

1. In [Firebase Authentication](https://console.firebase.google.com/project/sunday-circle-65c06/authentication) enable **Email/Password** and **Anonymous**.
2. Publish the `firestore.rules` in this repo (Firestore → Rules).
3. On the live site, tap **Editor sign in** → **Create account** with `windmills34@gmail.com`.
4. Check email if asked to verify, then sign in. Admin opens for the owner.
5. **Editors** tab: add a teacher’s email. They create their own account with that same email, verify it, then sign in.

The Firebase web `apiKey` in `config.js` is a public client identifier, not a secret. Security is the Auth providers + Firestore rules.

## Secretary each week

1. Sign in as owner or an approved editor.
2. Cover tab — bulletin. Publish.
3. Lesson tab — title, scripture, note, talk link, questions. Publish.
4. QR & link — share with the quorum.

## Changing the JavaScript

Edit files, commit, and push to `main`. Netlify deploys automatically. Users just refresh.

Do not reuse Member Tools or Church Account passwords.
