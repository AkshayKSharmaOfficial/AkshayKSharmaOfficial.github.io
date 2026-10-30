/* ============================================================
   GALLERY PHOTOS  -  yahan apni photos ki list likhein.
   Koi build / Node / install ki zaroorat nahi: file save karein aur page refresh karein.

   Steps:
   1) Photo ko is folder me copy karein:   assets/images/gallery/
   2) Neeche list me ek nayi line jodein (ek photo = ek { ... } block, end me comma).

   Example (// hatakar use karein):
   { src: "images/gallery/event-1.jpg", alt: "Students ke saath cyber awareness session", caption: "Cyber awareness session", category: "Events", date: "15 August 2026" },

   src      : photo ka path (hamesha "images/gallery/..." se shuru)
   alt      : photo ka chhota description (screen reader aur SEO ke liye zaroori)
   caption  : photo ke neeche dikhne wala text (optional)
   category : filter button ka naam, jaise "Events", "Sessions" (optional)
   date     : jaise "15 August 2026" (optional)

   Tip: photo ko 1600 pixel chaudai se badi na rakhein (website tez khulegi). .jpg ya .webp best hai.
   ============================================================ */
window.GALLERY_ITEMS = [
  { src: "images/gallery/ed-talk-certificate-trophy.jpg", alt: "Akshay Kumar Sharma receiving the Ed Talk Certificate of Achievement and trophy", caption: "Ed Talk India Season 2 - certificate and trophy", category: "Ed Talk", date: "" },
  { src: "images/gallery/ed-talk-interview.jpg", alt: "Akshay Kumar Sharma in an Ed Talk India Season 2 interview, New Delhi", caption: "Ed Talk India Season 2 interview, New Delhi", category: "Ed Talk", date: "" },
  { src: "images/gallery/ed-talk-awards-shelf.jpg", alt: "Ed Talk certificate, member badge and trophy displayed on a shelf", caption: "Ed Talk certificate, badge and trophy", category: "Ed Talk", date: "" },
  { src: "images/gallery/podcast-talks.jpg", alt: "Akshay Kumar Sharma seated in front of a microphone in a podcast studio", caption: "Podcast session", category: "Ed Talk", date: "" },
  { src: "images/gallery/linkedin-profile-session.jpg", alt: "Akshay K. Sharma's LinkedIn profile shown on a classroom screen during a session", caption: "Awareness session with students", category: "Sessions", date: "" },
  { src: "images/gallery/awareness-session-setup.jpg", alt: "Laptops showing an online cyber awareness session", caption: "Online awareness session", category: "Sessions", date: "" },
  { src: "images/gallery/discussion-session.jpg", alt: "Akshay Kumar Sharma in a discussion with two guests in an office", caption: "Discussion session", category: "Sessions", date: "" },
  { src: "images/gallery/live-cyber-discussion.jpg", alt: "Graphic announcing a live Zoom discussion on digital safety and cybercrime", caption: "Live cyber discussion (Zoom)", category: "Sessions", date: "" },
  { src: "images/gallery/cuh-conclave-1.jpg", alt: "Akshay Kumar Sharma with a fellow participant at the Central University of Haryana conclave", caption: "Central University of Haryana conclave", category: "Events", date: "" },
  { src: "images/gallery/cuh-conclave-2.jpg", alt: "Akshay Kumar Sharma with fellow participants at the Central University of Haryana conclave", caption: "Central University of Haryana conclave", category: "Events", date: "" },
  { src: "images/gallery/with-speaker-cuh.jpg", alt: "Akshay Kumar Sharma with a speaker at the conclave", caption: "At the conclave", category: "Events", date: "" },
  { src: "images/gallery/with-guests-group.jpg", alt: "Akshay Kumar Sharma with three guests at the conclave", caption: "At the conclave", category: "Events", date: "" },
  { src: "images/gallery/with-ethical-hacker-speaker.jpg", alt: "Akshay Kumar Sharma with a speaker at an event", caption: "At an event", category: "Events", date: "" },
  { src: "images/gallery/iit-delhi-visit.jpg", alt: "Akshay Kumar Sharma standing in front of the IIT Delhi building", caption: "IIT Delhi", category: "Events", date: "" },
  { src: "images/gallery/iit-delhi-group.jpg", alt: "Group photo of participants in front of the IIT Delhi building", caption: "IIT Delhi - group photo", category: "Events", date: "" },
  { src: "images/gallery/book-handover.jpg", alt: "Akshay Kumar Sharma presenting his book Cyber Security and Ethical Hacking", caption: "Book: Cyber Security and Ethical Hacking", category: "Book", date: "" },
  { src: "images/gallery/cybersec-akshay-plaque.jpg", alt: "Akshay Kumar Sharma receiving a CyberSec Akshay plaque", caption: "CyberSec Akshay plaque", category: "Memories", date: "" },
  { src: "images/gallery/milestone-award.jpg", alt: "Akshay Kumar Sharma receiving a Milestone commemorative plaque", caption: "Milestone plaque", category: "Memories", date: "" },
  { src: "images/gallery/working-laptop.jpg", alt: "Akshay Kumar Sharma working on a laptop", caption: "Working on a laptop", category: "Memories", date: "" },
];
