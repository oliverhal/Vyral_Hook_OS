import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

// Language map researched 2026-08-04 via Instagram/TikTok profile checks + name analysis
// Key: email (lowercased), Value: language string
const LANGUAGE_MAP: Record<string, string> = {
  // German
  "sonja.buschbacher97@gmail.com": "German",
  "travel.sonja.inquiries@gmail.com": "German",
  "alina.schiffmann@gmx.net": "German",
  "fseizmair45@gmail.com": "German",
  "sarahkrause1603@gmail.com": "German",
  "lisasokolska@gmail.com": "German",
  "linnea.hennig@t-online.de": "German",
  "k.verena2@web.de": "German",
  "svenmoritz99sge@gmail.com": "German",
  "ecommo27@gmail.com": "German, Arabic",
  "businessmitlaura@gmail.com": "German",
  "schindha17@gmail.com": "German",
  "mathi@vanderpost.de": "German",
  "samjames.flp@gmail.com": "German, English",

  // Dutch
  "nynkeherik@gmail.com": "Dutch",
  "tanja-tanja@live.nl": "Dutch",
  "isabelvandenbrink123@gmail.com": "Dutch, German",
  "mia.de.boer@gmx.de": "Dutch",
  "bosbeatrice5@gmail.com": "Dutch",

  // Italian
  "rossini.chiara20@gmail.com": "Italian",
  "ginevra.scaramucci@gmail.com": "Italian",
  "enricoemail02@gmail.com": "Italian",
  "Micael.Lariccia@gmail.com": "Italian",
  "gianantonio.cami@icloud.com": "Italian",
  "a.dburroni@gmail.com": "Italian",
  "marziaamendolia03@gmail.com": "Italian",
  "chiara05.home@gmail.com": "Italian",
  "mariailenia.destito@gmail.com": "Italian",
  "camillamenegaldo27@gmail.com": "Italian",
  "remma2.milano@gmail.com": "Italian",
  "vany98@tiscali.it": "Italian",
  "robeeugenia@gmail.com": "Romanian, Italian",
  "carolinabugaj1@gmail.com": "Polish, English",
  "gamalerocarlo@gmail.com": "Italian, French, Spanish, English",

  // Portuguese
  "ugc.anamorais@gmail.com": "Portuguese, Spanish, English",
  "04martins.vanessa@gmail.com": "Portuguese",
  "sofiabusiness86@gmail.com": "Portuguese",
  "sofiafernandes2712@gmail.com": "Portuguese",
  "bernardomarchana@hotmail.com": "Portuguese, Spanish",

  // Spanish
  "marihurcar02@gmail.com": "Spanish",
  "alejandrom.creator@gmail.com": "Spanish, English",
  "germanlozano99@gmail.com": "Spanish",
  "edwinraybiz@gmail.com": "Spanish, English",

  // French
  "melia.subra@gmail.com": "French",
  "mimaseye18@gmail.com": "French",

  // Polish
  "wiki2080@proton.me": "English",

  // Greek
  "nefeliknd@gmail.com": "Greek",

  // English (UK/Europe)
  "UGC.raf.ugc@gmail.com": "English",
  "clairebeishon@gmail.com": "English",
  "mynameisevelinx@gmail.com": "English",
  "Jenkins.ggd@gmail.com": "English",
  "mayaelizabethfalah@gmail.com": "English",
  "ryanthomasbco@gmail.com": "English",
  "profitswithpaige@hotmail.com": "English",
  "stella.marie.gordon@gmail.com": "English",
  "kemballpoppy@gmail.com": "English",
  "victoria.iglesias9@gmail.com": "Spanish, English",
  "julius.kirchner@code.berlin": "English, German",
  "workwithdishalokwani@gmail.com": "English",
  "ugcbyjasmine.108@gmail.com": "English",
  "pollybayntun@gmail.com": "English",
  "hannastrough@gmail.com": "English",
  "hello@ayushiacharya.com": "English",

  // English (US/Canada/Australia/Philippines)
  "kalaharmackenzie@gmail.com": "English",
  "fhussin9609@gmail.com": "English",
  "rayanbhaila@gmail.com": "English",
  "ericxie.hz@gmail.com": "English",
  "bykevinbui@gmail.com": "English",
  "kamilgulman.05@gmail.com": "English",
  "DustinLeeJones100@gmail.com": "English",
  "dakjon22@gmail.com": "English",
  "seanhunsicker8@gmail.com": "English",
  "deanhunsicker@gmail.com": "English",
  "ugcwithjayc@gmail.com": "English",
  "danielleugc92@gmail.com": "English",
  "amonitti.bobby@yahoo.com": "English",
  "genesisgemd@gmail.com": "English",
  "ugcwithsamba@gmail.com": "English",
  "acbusiness324@gmail.com": "English",
  "caitlinstrate@gmail.com": "English",
  "fridacoello03@gmail.com": "English, Spanish",
  "mishterj246@gmail.com": "English",
  "aarnavjain18@gmail.com": "English",
  "tingmakesmoves@gmail.com": "English",
  "gideonjansen17@gmail.com": "English",
  "zacharydg13@gmail.com": "English",
  "enzojoaquin.silvestre@gmail.com": "English, Filipino",
  "deannamae.business@gmail.com": "English, Filipino",
  "avani.n.apte@gmail.com": "English",
  "sukhjitsingh0976@gmail.com": "English",
};

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  if (body?.secret !== "vyral-enrich-2026") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let updated = 0;
  let notFound = 0;

  for (const [emailRaw, language] of Object.entries(LANGUAGE_MAP)) {
    const email = emailRaw.toLowerCase();
    const result = await prisma.creatorApplication.updateMany({
      where: { email: { equals: email, mode: "insensitive" } },
      data: { language },
    });
    if (result.count > 0) updated += result.count;
    else notFound++;
  }

  return NextResponse.json({ ok: true, updated, notFound });
}
