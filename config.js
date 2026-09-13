/* ============================================================
   SUNDAY CIRCLE — public site config (no passwords)
   ============================================================ */

window.SUNDAY_CIRCLE = {
  className: "Sunday Circle",
  tagline: "Elders Quorum notes, the conference talk, then this week’s lesson.",

  // Firebase Auth owner. This email may publish and manage editors.
  ownerEmail: "windmills34@gmail.com",

  starterCover: {
    weekLabel: "September 7–13, 2026",
    greeting: "Elders Quorum — Come Home",
    welcome:
      "This week we study Elder Clark G. Gilbert’s conference message. Watch or read the talk, leave a thought, and come ready to counsel together in quorum.",
    happenings: [
      { when: "Sun", what: "Sacrament meeting" },
      { when: "Sun · after Sunday School", what: "Elders Quorum — “Come Home,” Clark G. Gilbert" },
    ],
    needs: [
      "Share ministering needs with the presidency (only what is okay to post publicly).",
    ],
    birthdays: [
      { when: "Wed 10", who: "Dennis Rogers" },
      { when: "Sat 13", who: "Jason Lancaster" },
      { when: "Tue 16", who: "Colby Bowden" },
    ],
    thanks:
      "Thank you to every brother who showed up and ministered this week.",
  },

  starterTopic: {
    weekLabel: "September 7–13, 2026",
    title: "Come Home",
    scriptureRef: "Isaiah 58:12",
    scriptureText:
      "And they that shall be of thee shall build the old waste places: thou shalt raise up the foundations of many generations; and thou shalt be called, The repairer of the breach, The restorer of paths to dwell in.",
    body:
      "Elder Gilbert testifies that Jesus Christ is Redeemer and Repairer. Whether we feel we don’t belong, don’t measure up, carry doubts, or feel stuck in tradition, the Savior is still calling us home. The journey starts by reanchoring on Him — and for those helping someone else come back, we stay in our own covenants and “save a seat.”",
    videoUrl: "https://www.churchofjesuschrist.org/study/general-conference/2026/04/15gilbert?lang=eng",
    videoLabel: "Come Home — Elder Clark G. Gilbert (April 2026)",
    questions: [
      "Where do you see people (or yourself) hesitating to “come home” — belonging, measuring up, doubts, or tradition?",
      "What does “reanchoring on the Savior” look like for you this week?",
      "How can we as a quorum “save a seat” and hold up light for someone who’s weary?",
    ],
  },

  firebase: {
    apiKey: "AIzaSyDEme2ECnQVee1A3pVvyCNNLXst9_zVKGE",
    authDomain: "sunday-circle-65c06.firebaseapp.com",
    projectId: "sunday-circle-65c06",
    storageBucket: "sunday-circle-65c06.firebasestorage.app",
    messagingSenderId: "846762128446",
    appId: "1:846762128446:web:7102290f3667d8aacecd6f",
  },
};
