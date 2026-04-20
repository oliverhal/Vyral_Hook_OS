import { PrismaClient } from "@prisma/client";
import { addDays, startOfWeek, setHours, startOfDay } from "date-fns";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

function getMonday(date: Date): Date {
  return startOfDay(startOfWeek(date, { weekStartsOn: 1 }));
}

async function main() {
  console.log("Seeding database...");

  const defaultHash = await bcrypt.hash("vyral123", 10);
  const adminHash = await bcrypt.hash("admin123", 10);

  const [oliver, alex, jordan, sam, riley] = await Promise.all([
    prisma.user.upsert({ where: { email: "oliver@vyral-labs.com" }, update: {}, create: { name: "Oliver", email: "oliver@vyral-labs.com", password: adminHash, color: "blue", role: "admin" } }),
    prisma.user.upsert({ where: { email: "alex@vyral-labs.com" }, update: {}, create: { name: "Alex", email: "alex@vyral-labs.com", password: defaultHash, color: "violet" } }),
    prisma.user.upsert({ where: { email: "jordan@vyral-labs.com" }, update: {}, create: { name: "Jordan", email: "jordan@vyral-labs.com", password: defaultHash, color: "emerald" } }),
    prisma.user.upsert({ where: { email: "sam@vyral-labs.com" }, update: {}, create: { name: "Sam", email: "sam@vyral-labs.com", password: defaultHash, color: "orange" } }),
    prisma.user.upsert({ where: { email: "riley@vyral-labs.com" }, update: {}, create: { name: "Riley", email: "riley@vyral-labs.com", password: defaultHash, color: "pink" } }),
  ]);

  console.log("Created 5 users");

  const artie = await prisma.campaign.upsert({
    where: { id: "campaign-artie" },
    update: {},
    create: {
      id: "campaign-artie",
      name: "Artie Piano",
      clientName: "Artie",
      description: "Piano learning app — hook creators who are learning instruments or are music-curious",
      color: "orange",
      emoji: "🎹",
      hooksTarget: 14,
      hashtags: "#piano #learnpiano #pianobeginner #pianoforbeginners #learningpiano #pianolesson #pianotutorial #howtoplaypiano #pianopractice #pianotips #selftaughtpiano #pianostudent #musiclearning #pianojourney #keyboard #musictok",
    },
  });

  const faircado = await prisma.campaign.upsert({
    where: { id: "campaign-faircado" },
    update: {},
    create: {
      id: "campaign-faircado",
      name: "Faircado",
      clientName: "Faircado",
      description: "Sustainable second-hand marketplace for fashion and lifestyle",
      color: "emerald",
      emoji: "♻️",
      hooksTarget: 7,
      hashtags: "#sustainable #secondhand #thrifting #slowfashion #sustainablefashion #preloved #thrifthaul #secondhandfinds",
    },
  });

  const hookmusic = await prisma.campaign.upsert({
    where: { id: "campaign-hookmusic" },
    update: {},
    create: {
      id: "campaign-hookmusic",
      name: "HookMusic",
      clientName: "HookMusic Ltd.",
      description: "Music learning app — hook creators who play instruments",
      color: "violet",
      emoji: "🎵",
      hooksTarget: 7,
      hashtags: "#musiclearning #learnguitar #guitarlessons #pianolessons #guitarplayer #musictok",
    },
  });

  console.log("Created 3 campaigns");

  const now = new Date();
  const thisMonday = getMonday(now);
  const lastMonday = addDays(thisMonday, -7);
  const twoWeeksAgo = addDays(thisMonday, -14);
  const threeWeeksAgo = addDays(thisMonday, -21);

  function deadline(monday: Date) { return setHours(addDays(monday, 7), 18); }

  const [w1, w2, w3, w4, w5, w6, w7] = await Promise.all([
    prisma.week.upsert({ where: { campaignId_weekStart: { campaignId: artie.id, weekStart: thisMonday } }, update: {}, create: { campaignId: artie.id, weekStart: thisMonday, deadline: deadline(thisMonday), status: "open" } }),
    prisma.week.upsert({ where: { campaignId_weekStart: { campaignId: faircado.id, weekStart: thisMonday } }, update: {}, create: { campaignId: faircado.id, weekStart: thisMonday, deadline: deadline(thisMonday), status: "reviewing" } }),
    prisma.week.upsert({ where: { campaignId_weekStart: { campaignId: hookmusic.id, weekStart: thisMonday } }, update: {}, create: { campaignId: hookmusic.id, weekStart: thisMonday, deadline: deadline(thisMonday), status: "open" } }),
    prisma.week.upsert({ where: { campaignId_weekStart: { campaignId: artie.id, weekStart: lastMonday } }, update: {}, create: { campaignId: artie.id, weekStart: lastMonday, deadline: deadline(lastMonday), status: "finalized" } }),
    prisma.week.upsert({ where: { campaignId_weekStart: { campaignId: artie.id, weekStart: twoWeeksAgo } }, update: {}, create: { campaignId: artie.id, weekStart: twoWeeksAgo, deadline: deadline(twoWeeksAgo), status: "finalized" } }),
    prisma.week.upsert({ where: { campaignId_weekStart: { campaignId: artie.id, weekStart: threeWeeksAgo } }, update: {}, create: { campaignId: artie.id, weekStart: threeWeeksAgo, deadline: deadline(threeWeeksAgo), status: "finalized" } }),
    prisma.week.upsert({ where: { campaignId_weekStart: { campaignId: faircado.id, weekStart: lastMonday } }, update: {}, create: { campaignId: faircado.id, weekStart: lastMonday, deadline: deadline(lastMonday), status: "finalized" } }),
  ]);

  console.log("Created weeks");

  // Artie current week hooks (matching the Google Sheet structure)
  const artieHooks = [
    { user: alex, hookText: "best way to larp playing the piano is learning songs like this", format: "Faceless", caption: "Please add your own caption that includes that artie is an app e.g. the app is called Artie, thank me later ;)", referenceVideo: "https://www.tiktok.com/@artie" },
    { user: alex, hookText: "POV: someone made piano tiles but it teaches you songs IRL 🤯😤", format: "Faceless", caption: "Please add your own caption that includes that artie is an app e.g. the app is called Artie, thank me later ;)", referenceVideo: "https://www.tiktok.com/@artie" },
    { user: jordan, hookText: "POV: someone made piano tiles IRL 🤯😤", format: "Faceless", caption: "Please add your own caption that includes that artie is an app e.g. the app is called Artie, thank me later ;)", referenceVideo: "https://www.tiktok.com/@artie" },
    { user: jordan, hookText: "CHAT wdym I've been learning piano for 3 YEARS and just found this now??", format: "Snapchat", caption: "Please add your own caption that makes sense to the video (make sure to include artie)" },
    { user: sam, hookText: "Bruh I really been teaching myself piano for MONTHS and just found this now??", format: "Snapchat", caption: "Please add your own caption that makes sense to the video (make sure to include artie)", referenceVideo: "https://vm.tiktok.com/example" },
    { user: sam, hookText: "BROO wdym someone made piano tiles IRL but for learning piano 🤯😤", format: "Snapchat", caption: "Please add your own caption that makes sense to the video (make sure to include artie)", referenceVideo: "https://vm.tiktok.com/example" },
    { user: riley, hookText: "gonna fire my piano teacher now that I found this 😌", format: "Snapchat", caption: "Please add your own caption that makes sense to the video (make sure to include artie)", referenceVideo: "https://www.tiktok.com/@artie" },
    { user: riley, hookText: "rip piano teachers in 2026 now that this exists 🪦🪦🪦", format: "Snapchat", caption: "Please add your own caption that makes sense to the video (make sure to include artie)", referenceVideo: "https://www.tiktok.com/@artie" },
    { user: oliver, hookText: "i could SCREAM at my piano teacher for forcing me to learn sheet music when this exists 😤", format: "Snapchat", caption: "Please add your own caption that makes sense to the video (make sure to include artie)", referenceVideo: "https://www.tiktok.com/@artie" },
    { user: oliver, hookText: "crashing out bc my piano teacher never showed me this 😤🏹🏹", format: "Faceless", caption: "Please add your own caption that makes sense to the video (make sure to include artie)", referenceVideo: "https://www.tiktok.com/@artie", recordingNotes: "The hook should start with approximately 3 seconds of your face showing a strong emotional reaction, with text overlaid in the TikTok classic font. It then cuts to you playing the piano for around 7 seconds (no cuts in that video while paying), just like in the faceless videos, just make sure both the app and your fingers are visible. The text should remain on screen throughout. Please note that this is not a Snapchat hook, so no Snapchat-style text overlay, no camera flipping, just a clean cut between the face reaction and the piano. The reference video is just to get the concept of face reaction -> app footage." },
  ];

  for (const h of artieHooks) {
    await prisma.hook.create({
      data: {
        weekId: w1.id,
        submittedById: h.user.id,
        submitterName: h.user.name,
        hookText: h.hookText,
        format: h.format,
        caption: h.caption,
        referenceVideo: h.referenceVideo ?? null,
        recordingNotes: (h as { recordingNotes?: string }).recordingNotes ?? null,
        status: "submitted",
      },
    });
  }

  // Faircado current week (in review, some selected)
  const faircadoHooks = [
    { user: jordan, hookText: "POV: you just found the best sustainable fashion app and you're obsessed 😍", format: "Snapchat", caption: "Honestly didn't think I'd find pieces this good second-hand. Faircado changed the way I shop completely.", selected: true, order: 1 },
    { user: sam, hookText: "the reason I stopped buying fast fashion (it wasn't guilt 😭)", format: "Face-to-camera", caption: "I kept buying fast fashion knowing it was bad. Then I found Faircado and suddenly second-hand was actually... cool? And way cheaper. Didn't need the guilt trip, just needed a better option.", selected: true, order: 2 },
    { user: riley, hookText: "this app basically made sustainable shopping not cringe 💀", format: "Snapchat", caption: "Second-hand used to feel like compromise. Faircado made it feel like a flex. Genuinely can't believe the pieces I've found on here.", selected: true, order: 3 },
    { user: alex, hookText: "found a £400 jacket for £38 and I'm never buying new again", format: "Faceless", caption: "£38. That's what I paid for a jacket that retails at £400. Faircado is genuinely dangerous for my wallet lmao", selected: false, order: null },
  ];

  for (const h of faircadoHooks) {
    await prisma.hook.create({
      data: {
        weekId: w2.id,
        submittedById: h.user.id,
        submitterName: h.user.name,
        hookText: h.hookText,
        format: h.format,
        caption: h.caption,
        status: h.selected ? "selected" : "submitted",
        isSelected: h.selected,
        selectedOrder: h.order,
      },
    });
  }

  // HookMusic current week
  const hmHooks = [
    { user: oliver, hookText: "I learned guitar in 30 days with this app and my family cried 😭", format: "Face-to-camera", caption: "30 days ago I couldn't hold a chord. Tonight I played a full song in front of my family. HookMusic's AI figured out exactly what I needed and in what order. Unreal." },
    { user: alex, hookText: "10 minutes a day beats 2 hours on weekends every single time 🎸", format: "Voiceover", caption: "I used to binge practice on Sundays and wonder why I wasn't improving. HookMusic taught me the science — daily micro-practice builds muscle memory 3x faster. 10 minutes every morning and I've progressed more in 3 weeks than in 3 years." },
    { user: jordan, hookText: "POV: you paid £80/hour for guitar lessons that were making you worse", format: "Snapchat", caption: "True story. My guitar teacher was teaching me techniques completely wrong for my playing style. HookMusic analyzed my playing in the first session and built a plan that actually fit me. Haven't looked back." },
  ];

  for (const h of hmHooks) {
    await prisma.hook.create({
      data: {
        weekId: w3.id,
        submittedById: h.user.id,
        submitterName: h.user.name,
        hookText: h.hookText,
        format: h.format,
        caption: h.caption,
        status: "submitted",
      },
    });
  }

  // Finalized weeks for contribution board data
  const prevUsers = [oliver, alex, jordan, sam, riley];
  const prevFormats = ["Faceless", "Snapchat", "Face-to-camera", "Voiceover", "Faceless", "Snapchat", "Faceless"];

  const prevWeeks = [
    { week: w4, count: 7 },
    { week: w5, count: 5 },
    { week: w6, count: 3 },
  ];

  for (const { week, count } of prevWeeks) {
    for (let i = 0; i < count; i++) {
      const u = prevUsers[i % prevUsers.length];
      await prisma.hook.create({
        data: {
          weekId: week.id,
          submittedById: u.id,
          submitterName: u.name,
          hookText: `Artie hook ${i + 1} — ${week.id.slice(-4)}`,
          format: prevFormats[i % prevFormats.length],
          caption: "Caption placeholder for finalized hook",
          status: "selected",
          isSelected: true,
          selectedOrder: i + 1,
          aiCaption: i < 3 ? `AI-generated caption for hook ${i + 1}. This is what the creator posted — authentic, natural, drives downloads.` : null,
        },
      });
    }
  }

  // Faircado last week
  for (let i = 0; i < 5; i++) {
    const u = prevUsers[i];
    await prisma.hook.create({
      data: {
        weekId: w7.id,
        submittedById: u.id,
        submitterName: u.name,
        hookText: `Faircado hook ${i + 1} (last week)`,
        format: i % 2 === 0 ? "Faceless" : "Snapchat",
        caption: "Caption for previous Faircado week",
        status: "selected",
        isSelected: true,
        selectedOrder: i + 1,
      },
    });
  }

  console.log("Seeded all hooks");
  console.log("\n✅ Database seeded!\n");
  console.log("Login credentials:");
  console.log("  Admin:  oliver@vyral-labs.com / admin123");
  console.log("  Team:   alex@vyral-labs.com / vyral123");
  console.log("  Team:   jordan@vyral-labs.com / vyral123");
  console.log("  Team:   sam@vyral-labs.com / vyral123");
  console.log("  Team:   riley@vyral-labs.com / vyral123");
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
