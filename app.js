/* ============================================================================
 * Palm Harbor Fire Rescue — SOP & EMS Reference Hub
 * app.js — single-file application logic (rendered into #view)
 * Storage key: phfr_hub_v1 (localStorage). Optional Firestore sync via
 * firebase-config.js when window.FIREBASE_CONFIG is populated.
 * ========================================================================== */
'use strict';

/* ------------------------------ Utilities ------------------------------- */
const $ = (sel, root) => (root || document).querySelector(sel);
const $$ = (sel, root) => Array.from((root || document).querySelectorAll(sel));

/** Escape user-generated text before injecting into HTML. */
function esc(s) {
  return String(s == null ? '' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function uid(prefix) {
  return (prefix || 'id') + '_' + Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/** SHA-256 hash of (salt + value), hex encoded. Used for PINs and admin password. */
async function sha256Hex(value, salt) {
  const data = new TextEncoder().encode(String(salt) + '::' + String(value));
  const digest = await crypto.subtle.digest('SHA-256', data);
  return Array.from(new Uint8Array(digest)).map(b => b.toString(16).padStart(2, '0')).join('');
}

function makeSalt() {
  const bytes = new Uint8Array(16);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('');
}

function fmtDate(ts) {
  const d = new Date(ts);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }) + ' ' +
         d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function toast(msg, kind) {
  const root = $('#toast-root');
  const el = document.createElement('div');
  el.className = 'fade-in px-4 py-2 rounded-lg shadow-lg text-sm font-medium ' +
    (kind === 'error' ? 'bg-red-600 text-white' : 'bg-slate-800 text-white dark:bg-slate-700');
  el.textContent = msg;
  root.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity .3s'; setTimeout(() => el.remove(), 350); }, 2600);
}

function downloadFile(filename, content, mime) {
  const blob = new Blob([content], { type: mime || 'application/octet-stream' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 400);
}

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

/* ------------------------------ Library data ---------------------------- */
/* Summaries below are original training-aid descriptions, not SOP quotes. */

const MOM_URL = 'https://pcemsomd.com/wp-admin/admin-ajax.php?juwpfisadmin=false&action=wpfd&task=file.download&wpfd_category_id=182&wpfd_file_id=18236&token=56b6ccd32d0e4cce77d8481175b9f179&preview=1';

const COUNTY_SOPS = [
  ['600-01', 'Incident Command System', 'Reviewed May 2024', 'Establishes how command is set up and run at every incident: the first-arriving officer takes command, names the command post, tracks units, and keeps span of control manageable.'],
  ['600-02', 'Response, Placement, and Company Functions', 'Reviewed May 2024', 'Covers how companies respond, where apparatus is spotted on scene, and what each arriving company is expected to do so crews work from a common playbook.'],
  ['600-03', 'Safety', 'Reviewed May 2024', 'Sets the department safety culture on the fireground: everyone watches out for hazards, freelancing is prohibited, and unsafe conditions are reported up the chain immediately.'],
  ['600-04', 'Protective Clothing and SCBA Use', 'Reviewed May 2024', 'Defines when full structural PPE and self-contained breathing apparatus must be worn, including in smoke, IDLH atmospheres, and overhaul until the air is clear.'],
  ['600-05', 'Adverse Weather', 'Reviewed May 2024', 'Guides operations during storms, lightning, flooding, and extreme heat — adjusting tactics, protecting crews, and accounting for weather-driven hazards.'],
  ['600-06', 'Size-Up / On-Scene Radio Report', 'Reviewed May 2024', 'Standardizes the first-arriving report: what is burning, building and smoke conditions, exposures, actions underway, and what additional help is needed.'],
  ['600-07', 'Communications / Dispatch', 'Reviewed May 2024', 'Lays out radio discipline and dispatch procedures: clear text, proper channel use, and structured messages so everyone hears the same picture.'],
  ['600-08', 'Traffic Signal Preemption Procedures', 'Reviewed May 2024', 'Explains use of traffic-signal preemption devices on emergency response to move through intersections more safely.'],
  ['600-09', '(Blank — Reserved)', 'Reviewed May 2024', 'This SOP number is currently unassigned and reserved for future countywide use.'],
  ['600-10', 'Public Information Officer', 'Reviewed May 2024', 'Designates who speaks for the incident to the media, keeping messaging accurate, consistent, and coordinated with command.'],
  ['600-11', 'Accountability System', 'Reviewed May 2024', 'Mandates the passport-based accountability system and Personnel Accountability Reports (PAR) so command always knows who is where on scene.'],
  ['600-12', 'Rehabilitation', 'Reviewed May 2024', 'Requires rehab for crews during extended or strenuous incidents: rest, hydration, cooling, and medical monitoring before returning to duty.'],
  ['600-13', 'Rapid Intervention Crew', 'Reviewed May 2024', 'Requires a dedicated rescue crew standing by at working fires to go after firefighters who become lost, trapped, or injured — the 2-in/2-out rule in action.'],
  ['600-14', 'Automatic Alarm Response', 'Reviewed May 2024', 'Standard response to automatic fire alarms: investigate thoroughly, verify whether there is an actual emergency, and reset systems properly.'],
  ['600-15', 'Wildland Fire Management', 'Reviewed May 2024', 'Adapts structure-fire tactics to brush and wildland fires, emphasizing fire behavior, escape routes, and coordination with forestry resources.'],
  ['600-16', 'Response to Terrorism', 'Reviewed May 2024', 'Covers the added dangers of terrorist incidents: secondary devices, staging well clear, unified command with law enforcement, and responder safety first.'],
  ['600-17', 'High Rise Operations', 'Reviewed May 2024', 'Special procedures for tall buildings: lobby control, stairwell management, standpipe use, and moving large numbers of personnel and equipment upward.'],
  ['600-18', 'Sprinkler, Standpipe, and Fire Pump Operations', 'Reviewed May 2024', 'How to support built-in fire protection: supplying the fire department connection, boosting standpipes, and working with (not against) sprinkler systems.'],
  ['600-19', 'Gas Leak Response', 'Reviewed May 2024', 'Approach gas leaks by eliminating ignition sources, evacuating the area, monitoring the atmosphere, and letting the gas utility control the source.'],
  ['600-20', 'Hazardous Materials Initial Response', 'Reviewed May 2024', 'First-arriving hazmat actions: isolate the area, deny entry, identify the product from a safe distance, and call for the hazmat team.'],
  ['600-21', 'Ventilation Practices', 'Reviewed May 2024', 'Coordinates ventilation with the fire attack so crews release heat and smoke without pulling fire toward victims or interior crews.'],
  ['600-22', 'Water Rescue', 'Reviewed May 2024', 'Safe practices for water emergencies: proper flotation, reaching/throwing before going, and never entering the water without the right protection and backup.'],
  ['600-23', 'Technical Rescue Response', 'Reviewed May 2024', 'Framework for trench, collapse, confined space, and rope rescues: secure the scene, call for specialized teams, and avoid becoming a second victim.'],
  ['600-24', 'Civil Disturbances', 'Reviewed May 2024', 'Operating during civil unrest: coordinate closely with law enforcement, stage securely, and prioritize crew safety over property.'],
  ['600-25', 'Helicopter Operations', 'Reviewed May 2024', 'Landing-zone setup and safety around medical helicopters: site selection, securing loose objects, and crew coordination with the flight team.'],
  ['600-26', 'Commercial Marine Vessel Fires at Dock', 'Reviewed May 2024', 'Tactics for boats and ships tied up at dock: limited access, stability concerns, large water supply needs, and coordination with marine units.'],
  ['600-27', 'Carbon Monoxide Alarm Response', 'Reviewed May 2024', 'Investigate CO alarms with meters, evacuate occupants as needed, ventilate, and find the source before allowing re-entry.']
];

const DEPT_SOPS = [
  ['100', 'Incident Notification — Chief of Department', '2025 PHFR SOP', 'Defines which non-routine events the on-duty chief must push up to administration — from fatalities and major mutual-aid incidents to on-duty injuries and media interest — and the deputy-chief notification chain.'],
  ['101', 'Chain of Command', 'Admin can add', 'Department chain-of-command reference. Full text to be added by an administrator via the Admin Portal.'],
  ['200', 'Staffing & Minimum Manning', 'Admin can add', 'Staffing levels and minimum manning guidance. Full text to be added by an administrator via the Admin Portal.'],
  ['201', 'Station Duties & Daily Routine', 'Admin can add', 'Daily station routine and duty assignments. Full text to be added by an administrator via the Admin Portal.'],
  ['300', 'Apparatus Operations', 'Admin can add', 'Apparatus operation and response guidance. Full text to be added by an administrator via the Admin Portal.']
];

const MOM_DOCS = [
  ['MOM-00', 'Pinellas County EMS Medical Operations Manual (Full Document)', 'Current edition via pcemsomd.com',
   'The complete countywide medical operations manual — standing orders and protocols for BLS and ALS care in Pinellas County. Use the link below to open the current official document.',
   true]
];

/* ------------------------------ Question banks -------------------------- */
/* All questions are written in original words for training purposes.        */
/* Format: {id, cat, sop, q, o:[4 options], a:correctIndex, e:explanation}   */

const QCOUNTY = [
{id:'c01',cat:'county',sop:'600-01',q:'According to the Incident Command System SOP, how should the Incident Commander name the command post?',o:['Using the incident address street name or the city/district name','Using a random phonetic code assigned by dispatch','Using the first-arriving unit\u2019s radio designation only','Command posts are not named under this SOP'],a:0,e:'The SOP calls for the CP to be named for the city/district or the street name of the incident location.'},
{id:'c02',cat:'county',sop:'600-01',q:'Two working structure fires are happening at the same time in different locations. What does the SOP require for command names?',o:['They must each have their own unique command name','They may share one command name to keep radio traffic short','The second fire does not need a command name','Dispatch assigns whichever name is shortest'],a:0,e:'Two simultaneous incidents must not share a command name — each needs a distinct name to avoid confusion.'},
{id:'c03',cat:'county',sop:'600-01',q:'Where should the command post be located, and what must happen once it is set?',o:['In or at a vehicle with a good view of the fire building, with the location announced on the radio','In the basement of the fire building for protection','At the nearest fire station to keep it secure','Location does not matter as long as the IC has a radio'],a:0,e:'The CP should be at a vehicle with a good view of the fire building, and its location must be announced.'},
{id:'c04',cat:'county',sop:'600-01',q:'Per the ICS SOP, arriving apparatus should generally park:',o:['On the same side of the street, toward the Bravo/Delta side','On the opposite side of the street from the fire','Directly in front of the fire building\u2019s main entrance','Wherever the driver finds an open spot'],a:0,e:'Apparatus should park on the same side of the street, toward the Bravo/Delta (rear) side.'},
{id:'c05',cat:'county',sop:'600-01',q:'What tool does the SOP expect the IC to use to track units and assignments at an incident?',o:['A tactical worksheet or command board','A personal notebook kept in the IC\u2019s pocket','The dispatch CAD screen only','No tracking tool is required'],a:0,e:'The IC uses a tactical worksheet/command board and tracks unit passports to maintain accountability.'},
{id:'c06',cat:'county',sop:'600-11',q:'The accountability system required by SOP 600-11 is built around:',o:['A passport system in which each unit\u2019s tags are collected at the command post','A verbal headcount shouted across the fireground','GPS trackers issued to every firefighter','Signing a roster at the fire station before the shift'],a:0,e:'The SOP mandates the passport system — unit tags are gathered at the CP so command can track assignments.'},
{id:'c07',cat:'county',sop:'600-11',q:'What does "PAR" stand for in the accountability SOP?',o:['Personnel Accountability Report','Primary Attack Response','Post-Action Review','Protective Apparatus Requirement'],a:0,e:'PAR stands for Personnel Accountability Report — a roll call of all personnel on scene.'},
{id:'c08',cat:'county',sop:'600-11',q:'When should a PAR be conducted during an incident?',o:['At key benchmarks such as after a mayday, an evacuation, or a change in strategy','Only at the very end of the incident','Only when the fire chief arrives on scene','PAR checks are optional'],a:0,e:'PARs are done at critical points — after maydays, evacuations, strategy changes, and similar benchmarks.'},
{id:'c09',cat:'county',sop:'600-13',q:'What is the primary job of the Rapid Intervention Crew?',o:['Stand by as a dedicated crew ready to rescue firefighters who become lost, trapped, or injured','Take over the fire attack from the first-in engine','Direct traffic around the incident scene','Handle all radio communications for command'],a:0,e:'The RIC is a dedicated standby crew whose sole purpose is firefighter rescue.'},
{id:'c10',cat:'county',sop:'600-13',q:'The "2-in/2-out" rule behind the RIC requirement means:',o:['At least two firefighters enter together and at least two remain outside ready to assist','Two engines must arrive before any entry is made','Crews work in pairs for exactly two minutes at a time','Two officers must approve every interior assignment'],a:0,e:'Two in, two out: interior crews work in pairs with at least two firefighters outside ready to help.'},
{id:'c11',cat:'county',sop:'600-12',q:'Rehabilitation at an incident is required to provide crews with:',o:['Rest, hydration, cooling/warming, and medical monitoring','A full meal and a nap before returning to quarters','Punishment for working too slowly','Nothing — rehab is optional'],a:0,e:'Rehab provides rest, fluids, temperature control, and medical monitoring before crews go back to work.'},
{id:'c12',cat:'county',sop:'600-12',q:'When should a rehab sector be established?',o:['During extended, large-scale, or physically demanding incidents','Only on training days','After the incident is completely over','Only when the temperature is below freezing'],a:0,e:'Rehab is set up for long or strenuous operations where crew fatigue becomes a safety risk.'},
{id:'c13',cat:'county',sop:'600-04',q:'Per the PPE and SCBA SOP, breathing apparatus must be worn:',o:['Whenever operating in smoke or an IDLH atmosphere, and during overhaul until the air is verified clear','Only when the fire is fully involved','Only by the officer, not the crew','Only at hazardous materials incidents'],a:0,e:'SCBA is required in smoke/IDLH atmospheres and stays on through overhaul until the air is proven safe.'},
{id:'c14',cat:'county',sop:'600-04',q:'Which statement best reflects the SOP\u2019s approach to protective clothing?',o:['Full structural PPE is the minimum for fireground operations','PPE is optional once the fire is knocked down','Turnout gear is only needed at night','Gloves may be skipped for better dexterity on the fireground'],a:0,e:'The SOP treats full PPE as the baseline — it is not optional on the fireground.'},
{id:'c15',cat:'county',sop:'600-06',q:'A proper on-scene radio (size-up) report should include:',o:['What is burning, building and smoke conditions, exposures, actions being taken, and resources needed','Only the incident address','The names of all crew members on the apparatus','A request for the news media to respond'],a:0,e:'The size-up paints the picture: conditions, building, exposures, actions, and needs.'},
{id:'c16',cat:'county',sop:'600-06',q:'Who is responsible for giving the initial on-scene radio report?',o:['The first-arriving officer or company','Dispatch, based on the 911 call','The last unit to arrive','The fire chief, after arriving'],a:0,e:'The first-arriving officer gives the initial size-up so everyone shares the same picture.'},
{id:'c17',cat:'county',sop:'600-07',q:'The communications SOP emphasizes which style of radio traffic?',o:['Clear text — plain language instead of codes','Ten-codes for everything to save airtime','Whispering to keep the channel calm','Text messages instead of the radio'],a:0,e:'Clear text keeps messages understood by every agency on the channel.'},
{id:'c18',cat:'county',sop:'600-03',q:'Under the Safety SOP, "freelancing" on the fireground is:',o:['Prohibited — all members operate within the incident action plan','Encouraged for experienced firefighters','Allowed when command is busy','Required during overhaul'],a:0,e:'Everyone works inside the plan; freelancing is prohibited because it endangers crews and breaks accountability.'},
{id:'c19',cat:'county',sop:'600-03',q:'Who is responsible for safety at an incident?',o:['Every member on scene, in addition to command and safety officers','Only the designated safety officer','Only the incident commander','Safety is dispatch\u2019s responsibility'],a:0,e:'Safety is everyone\u2019s job — every member must recognize hazards and speak up.'},
{id:'c20',cat:'county',sop:'600-20',q:'The FIRST priority for the initial company at a suspected hazmat incident is to:',o:['Isolate the area and deny entry','Rush in to identify the chemical','Begin decontamination immediately','Move the leaking container'],a:0,e:'Isolate and deny entry first — identify the product from a safe distance, then call for the hazmat team.'},
{id:'c21',cat:'county',sop:'600-20',q:'How should responders identify an unknown hazardous material on initial response?',o:['From a safe distance using binoculars, shipping papers, or placards — without entering the hot zone','By smelling the substance to recognize it','By touching a small sample','By entering the spill area with SCBA to read the label up close'],a:0,e:'Identify from a safe distance; never enter the hot zone just to read a label.'},
{id:'c22',cat:'county',sop:'600-19',q:'At a natural gas leak, responders should:',o:['Eliminate ignition sources, evacuate the area, and let the gas utility control the source','Immediately shut off the gas at the street with any available tool','Light off the leaking gas to burn it away safely','Use power tools to dig up the leaking line'],a:0,e:'Kill ignition sources, get people out, monitor the air, and let the utility stop the leak.'},
{id:'c23',cat:'county',sop:'600-27',q:'When investigating a carbon monoxide alarm, crews should:',o:['Use a meter to check the atmosphere and evacuate occupants if CO is present','Assume it is a false alarm and reset the detector','Open windows and leave without metering','Tell occupants to call back tomorrow'],a:0,e:'Meter the space, evacuate as needed, ventilate, and find the source before re-entry.'},
{id:'c24',cat:'county',sop:'600-21',q:'Ventilation must be coordinated with the fire attack because:',o:['Poorly timed ventilation can pull fire toward victims or interior crews','Ventilation is never needed','It makes the fire burn slower','Coordination is only needed at high-rise fires'],a:0,e:'Ventilation changes fire behavior — it must be timed with attack so it does not endanger occupants or crews.'},
{id:'c25',cat:'county',sop:'600-18',q:'When a building has a fire department connection (FDC), arriving companies should:',o:['Supply the FDC to boost the building\u2019s sprinkler or standpipe system','Ignore it — built-in systems work on their own','Shut off the building\u2019s water supply first','Connect to it only after the fire is out'],a:0,e:'Supplying the FDC supports sprinklers and standpipes with the pressure and volume they were designed for.'},
{id:'c26',cat:'county',sop:'600-17',q:'A key position in high-rise operations is:',o:['Lobby control, to manage elevators, personnel, and equipment movement','The roof DJ booth','A photographer on the top floor','A second incident commander in the basement'],a:0,e:'Lobby control manages the flow of people and equipment — critical in tall buildings.'},
{id:'c27',cat:'county',sop:'600-14',q:'On an automatic alarm response, crews are expected to:',o:['Investigate thoroughly to confirm whether a real emergency exists','Assume it is false and return to service','Wait outside until the alarm company calls back','Only check the pull station nearest the door'],a:0,e:'Every alarm gets a real investigation — verify conditions before clearing the scene.'},
{id:'c28',cat:'county',sop:'600-16',q:'At a suspected terrorism incident, responders must consider:',o:['The possibility of secondary devices and stage well clear of the scene','That the scene is safe once police arrive','Rushing in quickly before the media arrives','That hazmat procedures do not apply'],a:0,e:'Secondary devices are a real threat — stage clear, use unified command with law enforcement, and put safety first.'},
{id:'c29',cat:'county',sop:'600-22',q:'The safest order of actions for a water rescue is:',o:['Reach or throw to the victim before entering the water yourself','Swim out immediately — speed matters most','Enter the water first, then look for flotation','Wait for the victim to swim to you'],a:0,e:'Reach, throw, row, then go — entering the water is the last resort, with proper flotation and backup.'},
{id:'c30',cat:'county',sop:'600-23',q:'At a technical rescue (trench, collapse, confined space), the first rule is to:',o:['Secure the scene and avoid becoming a second victim','Jump in immediately to save time','Start digging with heavy equipment right away','Send the newest firefighter in first'],a:0,e:'Scene safety first: stabilize, call for specialized teams, and never rush into the same trap.'},
{id:'c31',cat:'county',sop:'600-25',q:'When setting up a helicopter landing zone, crews should:',o:['Choose a clear, flat area, secure loose objects, and keep personnel clear of the rotor wash zone','Land the helicopter on the roadway between apparatus','Stand under the flight path to guide the pilot','Keep the landing zone as small as possible'],a:0,e:'A clear LZ with secured debris and personnel kept clear keeps the landing safe.'},
{id:'c32',cat:'county',sop:'600-15',q:'A major concern when shifting from structure tactics to wildland fire is:',o:['Fire behavior driven by wind, fuel, and terrain — with escape routes always identified','That wildland fires never threaten structures','That water is never needed','That the wind always helps firefighters'],a:0,e:'Wildland fire behavior is driven by weather, fuel, and topography — always know your escape routes.'},
{id:'c33',cat:'county',sop:'600-24',q:'During civil disturbances, fire operations should:',o:['Coordinate closely with law enforcement and prioritize crew safety','Operate independently without police involvement','Rush into the middle of the crowd for faster access','Leave all protective equipment at the station'],a:0,e:'Work with law enforcement, stage securely, and put crew safety ahead of property.'},
{id:'c34',cat:'county',sop:'600-10',q:'Under the PIO SOP, media inquiries at an incident should be directed to:',o:['The designated public information officer or command','Any firefighter near the cameras','The newest probationary member','Dispatch, by phone only'],a:0,e:'One coordinated voice — the PIO or command — keeps incident messaging accurate.'},
{id:'c35',cat:'county',sop:'600-09',q:'SOP 600-09 in the county series is currently:',o:['Blank and reserved for future use','The most frequently used SOP','About marine vessel fires','Retired and deleted'],a:0,e:'600-09 is an unassigned, reserved number in the series.'},
{id:'c36',cat:'county',sop:'600-26',q:'Fires on commercial marine vessels at dock present special challenges including:',o:['Limited access, vessel stability concerns, and large water supply needs','That boats cannot burn','That no special coordination is needed','That water supply is never an issue'],a:0,e:'Vessel fires mean tight access, stability risks, and big water demands — coordinate with marine units.'},
{id:'c37',cat:'county',sop:'600-08',q:'Traffic signal preemption devices are used to:',o:['Change signals in favor of responding emergency vehicles at intersections','Turn off all traffic lights in the city','Speed up the fire apparatus engine','Replace the siren'],a:0,e:'Preemption gives emergency vehicles a green light, reducing intersection risk on response.'},
{id:'c38',cat:'county',sop:'600-05',q:'During adverse weather operations, command should consider:',o:['Lightning, flooding, and heat effects on both the incident and crew safety','That weather never affects fire behavior','Cancelling all responses during rain','That lightning is only dangerous at night'],a:0,e:'Storms, lightning, floodwater, and extreme heat all change tactics and threaten crews.'},
{id:'c39',cat:'county',sop:'600-02',q:'The first-arriving company at a working fire is generally expected to:',o:['Assume command, give a size-up, and begin fire attack or rescue as conditions dictate','Wait for the battalion chief before doing anything','Park two blocks away and observe','Begin overhaul immediately'],a:0,e:'First in takes command, reports conditions, and acts on the most urgent priority — rescue or attack.'},
{id:'c40',cat:'county',sop:'600-01',q:'Keeping "span of control" manageable under ICS means a supervisor should directly oversee:',o:['A limited number of people or units — typically around five, never a huge group','As many units as possible to save radio time','Only one person at a time','The entire incident by themselves'],a:0,e:'ICS works when each supervisor manages a small, effective number of subordinates.'}
];

const QDEPT = [
{id:'d01',cat:'dept',sop:'100',q:'SOP 100 requires the on-duty chief to notify administration of which of the following?',o:['Any non-medical fatality at an incident','A routine medical call with no complications','A station tour for school children','A minor equipment check that passed'],a:0,e:'Non-medical fatalities are specifically listed as non-routine events requiring admin notification.'},
{id:'d02',cat:'dept',sop:'100',q:'A large-scale mutual-aid incident occurs. Under SOP 100, the on-duty chief should:',o:['Notify the chain of command up to administration','Handle it quietly with no notifications','Wait until the next business day to mention it','Only tell the neighboring department'],a:0,e:'Large-scale mutual-aid responses are non-routine events that trigger the notification chain.'},
{id:'d03',cat:'dept',sop:'100',q:'An on-duty firefighter is injured and requires treatment or transport. Per SOP 100:',o:['Administration must be notified','No notification is needed for minor injuries','Only the union representative is notified','The crew handles it with no report'],a:0,e:'On-duty injuries requiring treatment or transport must be pushed up the chain.'},
{id:'d04',cat:'dept',sop:'100',q:'An incident occurs on department property. SOP 100 says:',o:['It requires administrative notification','It is exempt from all reporting','Only maintenance needs to know','It should be kept off the record'],a:0,e:'Incidents on department property are on the notification list regardless of severity.'},
{id:'d05',cat:'dept',sop:'100',q:'A department vehicle is involved in a mishap with injury or damage. Under SOP 100:',o:['Notify administration','Just buff out the damage and move on','Only notify if a civilian was involved','Report it at the next staff meeting'],a:0,e:'Vehicle mishaps involving injury or damage require admin notification.'},
{id:'d06',cat:'dept',sop:'100',q:'A company will be out of service for more than one hour. SOP 100 requires:',o:['Administrative notification','No action — it is routine','A social media post','Notification only after the company returns'],a:0,e:'A company out of service longer than an hour affects coverage, so administration must be told.'},
{id:'d07',cat:'dept',sop:'100',q:'The media shows interest in an incident. Per SOP 100, the on-duty chief should:',o:['Notify administration so the PIO process can be coordinated','Give interviews immediately without telling anyone','Refuse to acknowledge the incident exists','Let any crew member speak on camera'],a:0,e:'Media interest triggers notification so messaging stays accurate and coordinated.'},
{id:'d08',cat:'dept',sop:'100',q:'An MCI (mass casualty incident) or hazmat incident occurs. Under SOP 100:',o:['Administration must be notified','These are routine and need no notification','Only the hospital is notified','Notification is optional'],a:0,e:'MCI and hazmat incidents are explicitly listed as non-routine events requiring notification.'},
{id:'d09',cat:'dept',sop:'100',q:'According to SOP 100, the FIRST person in the notification chain is:',o:['Deputy Chief Malpass at (727) 648-3802','The fire chief\u2019s home phone','The city manager','The county sheriff'],a:0,e:'The chain starts with Deputy Chief Malpass at (727) 648-3802.'},
{id:'d10',cat:'dept',sop:'100',q:'If the first deputy chief cannot be reached, SOP 100 directs the caller to contact:',o:['Deputy Chief Breuer at (727) 417-4287','Wait and try the same number again tomorrow','The governor\u2019s office','No one else — the chain ends there'],a:0,e:'Deputy Chief Breuer at (727) 417-4287 is next in the chain.'},
{id:'d11',cat:'dept',sop:'100',q:'Why does SOP 100 require notification of non-routine events?',o:['So administration can support the incident, manage resources, and handle follow-up','To punish the on-duty chief','To create extra paperwork for crews','To delay the response'],a:0,e:'Early notification lets administration support operations, manage coverage, and handle media and follow-up.'},
{id:'d12',cat:'dept',sop:'100',q:'Which of these is NOT listed in SOP 100 as requiring admin notification?',o:['A routine lift-assist with no injury','A non-medical fatality','A vehicle mishap with damage','Media interest in an incident'],a:0,e:'Routine calls without injury or special circumstances are not on the notification list.'},
{id:'d13',cat:'dept',sop:'100',q:'The notification chain in SOP 100 exists to make sure:',o:['Information reaches administration quickly and in the right order','Everyone in the county hears about it','The news gets the story first','Crews can avoid paperwork'],a:0,e:'A defined chain means the right people are told promptly, in order.'},
{id:'d14',cat:'dept',sop:'101',q:'The department chain of command generally flows:',o:['From firefighter up through officer, battalion/district chief, deputy chief, to the fire chief','From the fire chief down to probationary members only','Sideways between stations with no officers involved','Directly from any member to the city commission'],a:0,e:'The chain runs upward through each level of supervision to the fire chief.'},
{id:'d15',cat:'dept',sop:'200',q:'Minimum staffing requirements exist primarily to:',o:['Ensure enough personnel are available to operate safely and effectively','Keep overtime costs at zero','Limit the number of firefighters per station','Satisfy insurance paperwork only'],a:0,e:'Minimum manning protects both the public and crews by keeping units capable.'},
{id:'d16',cat:'dept',sop:'300',q:'Apparatus should be positioned on scene with consideration for:',o:['Safety of the crew, access for operations, and leaving room for additional units','Parking as close to the fire as physically possible','Blocking all lanes of traffic in both directions','Appearance in news photographs'],a:0,e:'Safe, functional positioning balances crew protection, operational access, and incoming units.'},
{id:'d17',cat:'dept',sop:'100',q:'If two notifiable events happen on the same shift, the on-duty chief should:',o:['Notify on each event — both require administrative notification','Pick the bigger one and skip the other','Wait until end of shift and send one vague message','Only notify if the chief asks'],a:0,e:'Each non-routine event independently triggers the notification requirement.'},
{id:'d18',cat:'dept',sop:'201',q:'Daily station duties and routines matter because they:',o:['Keep the station, apparatus, and equipment response-ready','Are mainly for show during inspections','Replace the need for training','Are optional when the crew is tired'],a:0,e:'Consistent daily routines keep everything ready for the next call.'},
{id:'d19',cat:'dept',sop:'100',q:'SOP 100\u2019s notification requirement applies to events that are:',o:['Non-routine — outside the normal day-to-day calls','Every single call, no matter how minor','Only fires, never medical calls','Only events after midnight'],a:0,e:'The SOP targets non-routine events; routine calls do not trigger the chain.'},
{id:'d20',cat:'dept',sop:'100',q:'A company is out of service for 45 minutes for a quick repair. Under SOP 100:',o:['No administrative notification is required — it is under one hour','Administration must still be notified','The state must be notified','The crew must stay out of service for a full hour'],a:0,e:'The threshold is more than one hour; 45 minutes does not trigger notification.'},
{id:'d21',cat:'dept',sop:'100',q:'When notifying up the chain, the on-duty chief should be prepared to provide:',o:['Clear facts: what happened, where, who is affected, and what is being done','Only the incident address','A guess about the cause','Nothing — administration will figure it out'],a:0,e:'Clear, factual information lets administration make good decisions quickly.'},
{id:'d22',cat:'dept',sop:'100',q:'The phone numbers in SOP 100\u2019s notification chain are important because:',o:['They are the direct lines to reach the deputy chiefs promptly','They are the station fax numbers','They are for pizza delivery','They change every shift'],a:0,e:'Direct numbers keep the chain fast when minutes matter.'},
{id:'d23',cat:'dept',sop:'300',q:'Before placing apparatus in service each shift, crews should:',o:['Check it over — fluids, equipment, lights, and radio function','Assume the previous shift left it perfect','Only check the fuel gauge','Wash it, which counts as the full check'],a:0,e:'A proper rig check catches problems before they matter on a call.'},
{id:'d24',cat:'dept',sop:'100',q:'An on-duty injury that does NOT require treatment or transport:',o:['Should still be documented per department injury procedures, even though SOP 100\u2019s admin notification targets injuries needing treatment/transport','Can be completely ignored','Requires a call to the governor','Means the firefighter is fired'],a:0,e:'SOP 100\u2019s notification threshold is treatment/transport, but all injuries still need proper documentation.'},
{id:'d25',cat:'dept',sop:'101',q:'When the chain of command is unclear at a scene, members should:',o:['Ask their immediate supervisor and follow the incident command structure','Do whatever seems best individually','Call the fire chief directly every time','Stop working until it is sorted out in writing'],a:0,e:'Use the immediate supervisor and the ICS structure — never freelance outside it.'}
];

const QMOM = [
{id:'m01',cat:'mom',sop:'MOM',q:'When assessing a possible stroke, the most important piece of history to obtain is:',o:['The last-known-well time','The patient\u2019s favorite food','What the patient watched on TV','The patient\u2019s shoe size'],a:0,e:'Last-known-well time determines eligibility for time-sensitive stroke treatments.'},
{id:'m02',cat:'mom',sop:'MOM',q:'The BE-FAST stroke screen includes all of the following EXCEPT:',o:['Blood pressure measurement','Balance','Eyes','Facial droop'],a:0,e:'BE-FAST covers Balance, Eyes, Face, Arms, Speech, Time — blood pressure is assessed separately.'},
{id:'m03',cat:'mom',sop:'MOM',q:'For a patient with signs of anaphylaxis, the priority medication is:',o:['Epinephrine','Oral antihistamine only','Aspirin','Insulin'],a:0,e:'Epinephrine is the first-line, life-saving treatment for anaphylaxis.'},
{id:'m04',cat:'mom',sop:'MOM',q:'Epinephrine for anaphylaxis is most commonly given:',o:['Intramuscularly in the lateral thigh','Intravenously as a slow drip only','Orally with water','Subcutaneously in the forearm'],a:0,e:'IM injection in the lateral thigh gives fast, reliable absorption.'},
{id:'m05',cat:'mom',sop:'MOM',q:'High-quality CPR requires a compression rate of:',o:['100 to 120 per minute','60 per minute','As fast as possible without counting','40 per minute'],a:0,e:'100–120 compressions per minute with full recoil is the standard for effective CPR.'},
{id:'m06',cat:'mom',sop:'MOM',q:'In adult cardiac arrest, rescuers should minimize interruptions in compressions and aim for a chest compression fraction of:',o:['Greater than 80%','Less than 40%','Exactly 50%','It does not matter'],a:0,e:'Keeping the compression fraction above 80% maximizes blood flow during arrest.'},
{id:'m07',cat:'mom',sop:'MOM',q:'For a patient who is competent and refusing care, the refusal is valid only if:',o:['The patient has decision-making capacity and is informed of the risks of refusal','The patient signs anything quickly','A family member agrees with the refusal','The crew is busy with another call'],a:0,e:'Valid refusal requires capacity plus an understanding of the risks — and it must be documented.'},
{id:'m08',cat:'mom',sop:'MOM',q:'Documentation of a patient refusal should include:',o:['Capacity assessment, risks explained, and a witness signature when possible','Only the patient\u2019s name','Nothing — refusals need no documentation','The crew\u2019s personal opinions'],a:0,e:'Thorough refusal documentation protects the patient and the crew.'},
{id:'m09',cat:'mom',sop:'MOM',q:'TXA (tranexamic acid) is generally considered for:',o:['Bleeding trauma patients within a few hours of injury','All headaches','Minor nosebleeds only','Patients with no bleeding at all'],a:0,e:'TXA is an antifibrinolytic used for significant bleeding in trauma, given early.'},
{id:'m10',cat:'mom',sop:'MOM',q:'A known contraindication to TXA administration is:',o:['Giving it many hours after the injury, well outside the treatment window','A scraped knee','A patient who is fully alert','Mild pain'],a:0,e:'TXA\u2019s benefit is time-limited — it should be given early after injury, not many hours later.'},
{id:'m11',cat:'mom',sop:'MOM',q:'Pediatric medication doses are primarily based on:',o:['The child\u2019s weight','The child\u2019s age alone','A standard adult dose cut in half','The parent\u2019s estimate'],a:0,e:'Weight-based dosing keeps pediatric medications safe and effective.'},
{id:'m12',cat:'mom',sop:'MOM',q:'When a length-based resuscitation tape is unavailable, an alternative for estimating pediatric weight is:',o:['A validated pediatric weight-estimation method or recent known weight','Guessing based on height alone','Using the adult dose','Asking the child to choose'],a:0,e:'Use a validated estimation tool or a recent known weight — never guess blindly.'},
{id:'m13',cat:'mom',sop:'MOM',q:'For a trauma patient, the first priority in the primary survey is:',o:['Airway — with cervical spine protection if indicated','Splinting the ankle','Taking a full set of vital signs','Calling the patient\u2019s family'],a:0,e:'Airway comes first in the primary survey, protecting the C-spine when trauma is involved.'},
{id:'m14',cat:'mom',sop:'MOM',q:'A trauma patient with uncontrolled external hemorrhage should first receive:',o:['Direct pressure and a tourniquet if the bleeding is from an extremity','A drink of water','Ice on the forehead','A splint before bleeding control'],a:0,e:'Stop the bleeding first — direct pressure, then a tourniquet for life-threatening extremity hemorrhage.'},
{id:'m15',cat:'mom',sop:'MOM',q:'Signs of a tension pneumothorax include:',o:['Difficulty breathing, absent breath sounds on one side, and signs of shock','A normal exam','Only a mild cough','Improved breathing when lying flat'],a:0,e:'Tension pneumothorax is a life threat: respiratory distress, unilateral absent sounds, and shock.'},
{id:'m16',cat:'mom',sop:'MOM',q:'For a patient in anaphylaxis who is hypotensive, positioning and care include:',o:['Supine with legs elevated unless breathing is compromised, plus epinephrine','Standing upright','Prone on the stomach','Sitting in a car seat'],a:0,e:'Supine positioning supports perfusion; epinephrine remains the priority drug.'},
{id:'m17',cat:'mom',sop:'MOM',q:'Oxygen therapy for most patients should be:',o:['Titrated to the patient\u2019s condition and oxygen saturation','Given at maximum flow to everyone','Withheld from all COPD patients entirely','Given only if the patient asks'],a:0,e:'Titrate oxygen to need — enough to correct hypoxia without unnecessary excess.'},
{id:'m18',cat:'mom',sop:'MOM',q:'For a diabetic patient with altered mental status and suspected hypoglycemia who cannot swallow safely:',o:['Do not give oral glucose — use an appropriate parenteral option per protocol','Pour juice down their throat anyway','Give insulin immediately','Wait and see if they wake up'],a:0,e:'Never give oral sugar to someone who cannot protect their airway; use protocol-directed alternatives.'},
{id:'m19',cat:'mom',sop:'MOM',q:'Signs suggesting sepsis include:',o:['Fever or hypothermia, rapid heart rate, rapid breathing, and signs of infection','Only a paper cut','A normal temperature with no other findings','Hunger and thirst'],a:0,e:'Sepsis is suggested by infection plus abnormal vitals and altered perfusion — recognize it early.'},
{id:'m20',cat:'mom',sop:'MOM',q:'For chest pain of suspected cardiac origin, a 12-lead ECG should be obtained:',o:['As early as possible — ideally within minutes of patient contact','After arriving at the hospital','Only if the patient requests it','The next day'],a:0,e:'Early 12-lead acquisition speeds recognition of STEMI and cath-lab activation.'},
{id:'m21',cat:'mom',sop:'MOM',q:'Aspirin is commonly given for suspected cardiac chest pain because it:',o:['Inhibits platelet aggregation','Lowers blood sugar','Treats infection','Reverses opioids'],a:0,e:'Aspirin\u2019s antiplatelet effect is the reason it is given early in suspected ACS.'},
{id:'m22',cat:'mom',sop:'MOM',q:'Naloxone is indicated for:',o:['Opioid overdose with respiratory depression','Allergic reactions','Diabetic emergencies','Stroke'],a:0,e:'Naloxone reverses opioid-induced respiratory depression.'},
{id:'m23',cat:'mom',sop:'MOM',q:'After naloxone reverses an overdose, the patient must be monitored because:',o:['Naloxone wears off sooner than many opioids, so the patient can relapse into overdose','They are fully cured','Opioids are no longer in the body','Monitoring is a waste of time'],a:0,e:'Naloxone\u2019s short duration means re-sedation is possible — keep watching the patient.'},
{id:'m24',cat:'mom',sop:'MOM',q:'The "rule of nines" is used in burns to estimate:',o:['The percentage of total body surface area burned','The patient\u2019s age','How much water to drink','The depth of the burn in millimeters'],a:0,e:'The rule of nines quickly estimates burn size, which guides fluid resuscitation and triage.'},
{id:'m25',cat:'mom',sop:'MOM',q:'For a seizing patient, the priority during the seizure is to:',o:['Protect from injury and maintain the airway — do not restrain or place objects in the mouth','Hold the patient down firmly','Put a wallet between the teeth','Give oral medications immediately'],a:0,e:'Protect, position, and wait — never force anything into the mouth or restrain the seizure.'},
{id:'m26',cat:'mom',sop:'MOM',q:'Spinal motion restriction is considered for patients with:',o:['A concerning mechanism of injury or signs of spinal injury','Every headache','A stubbed toe','Mild anxiety'],a:0,e:'Mechanism and exam findings drive spinal precautions — not every complaint.'},
{id:'m27',cat:'mom',sop:'MOM',q:'In a normal childbirth that is imminent in the field, the attendant should:',o:['Support the delivery, keep the newborn warm and dry, and assess breathing','Pull on the baby to speed things up','Cut the cord immediately before delivery','Leave the scene'],a:0,e:'Support the birth, prevent heat loss, and assess the newborn — warmth and airway first.'},
{id:'m28',cat:'mom',sop:'MOM',q:'Heat stroke is distinguished from heat exhaustion by:',o:['Altered mental status and hot skin — it is a life-threatening emergency','Mild sweating only','That it is never serious','A normal body temperature'],a:0,e:'AMS with hyperthermia marks heat stroke — cool aggressively and transport emergently.'},
{id:'m29',cat:'mom',sop:'MOM',q:'For a hypothermic patient, rescuers should:',o:['Handle gently, prevent further heat loss, and avoid rough movement','Rub the limbs vigorously','Give alcohol to warm them','Have the patient run in place'],a:0,e:'Gentle handling matters — a cold heart is irritable, and further heat loss must be stopped.'},
{id:'m30',cat:'mom',sop:'MOM',q:'A patient with DKA (diabetic ketoacidosis) may present with:',o:['Fruity-smelling breath, deep rapid breathing, dehydration, and altered mentation','Low blood sugar only','No symptoms at all','A normal blood glucose'],a:0,e:'DKA\u2019s classic picture includes fruity breath, Kussmaul respirations, dehydration, and AMS.'}
];

const BANKS = { county: QCOUNTY, dept: QDEPT, mom: QMOM };
const CAT_LABELS = { county: 'County SOPs (600 Series)', dept: 'Department SOPs', mom: 'EMS Medical SOPs (MOMs)', mixed: 'Mixed Review' };

/* Custom questions generated by admin (stored, merged into banks at runtime). */
function allQuestions(cat) {
  const store = getStore();
  const base = (BANKS[cat] || []).slice();
  (store.customQuestions || []).forEach(cq => { if (cq.cat === cat) base.push(cq); });
  return base;
}

/* ------------------------------ Data store ------------------------------ */
const STORE_KEY = 'phfr_hub_v1';

function defaultStore() {
  return { profiles: [], currentProfileId: null, results: [], customQuestions: [], customDocs: [], admin: null };
}

function getStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return defaultStore();
    const s = JSON.parse(raw);
    const d = defaultStore();
    return Object.assign(d, s);
  } catch (e) { return defaultStore(); }
}

function saveStore(s) {
  localStorage.setItem(STORE_KEY, JSON.stringify(s));
  scheduleCloudSync();
}

function currentProfile() {
  const s = getStore();
  return s.profiles.find(p => p.id === s.currentProfileId) || null;
}

function profileResults(profileId) {
  return getStore().results.filter(r => r.profileId === profileId)
    .sort((a, b) => b.date - a.date);
}

/* ------------------------------ Theme ----------------------------------- */
function applyTheme() {
  const t = localStorage.getItem('phfr_theme') || 'light';
  document.documentElement.classList.toggle('dark', t === 'dark');
  const icon = $('#theme-icon');
  if (icon) icon.textContent = t === 'dark' ? '☀️' : '🌙';
  const meta = $('#meta-theme');
  if (meta) meta.setAttribute('content', t === 'dark' ? '#020617' : '#0f2a4a');
}

function toggleTheme() {
  const t = localStorage.getItem('phfr_theme') || 'light';
  localStorage.setItem('phfr_theme', t === 'dark' ? 'light' : 'dark');
  applyTheme();
}

/* ------------------------------ Router ---------------------------------- */
let currentView = 'home';
let detailResultId = null;

function navTo(view, param) {
  currentView = view;
  $$('.nav-btn').forEach(b => {
    const active = b.dataset.view === view;
    b.classList.toggle('bg-white/20', active);
    b.classList.toggle('font-bold', active);
  });
  const v = $('#view');
  v.classList.remove('fade-in'); void v.offsetWidth; v.classList.add('fade-in');
  if (view === 'home') renderHome(v);
  else if (view === 'library') renderLibrary(v);
  else if (view === 'quiz') renderQuizSetup(v);
  else if (view === 'progress') renderProgress(v);
  else if (view === 'test') { detailResultId = param || null; renderTestDetail(v, detailResultId); }
  else if (view === 'admin') renderAdmin(v);
  window.scrollTo({ top: 0 });
}

/* ------------------------------ Header / auth ---------------------------- */
function refreshHeader() {
  const p = currentProfile();
  const chip = $('#user-chip');
  const btn = $('#auth-btn');
  if (p) {
    chip.innerHTML = '<span class="text-xs bg-white/15 rounded-full px-3 py-1.5">👤 ' + esc(p.name) + '</span>';
    btn.textContent = 'Sign out';
  } else {
    chip.innerHTML = '';
    btn.textContent = 'Sign in';
  }
}

function openModal(html, wide) {
  const root = $('#modal-root');
  root.innerHTML =
    '<div class="fixed inset-0 z-50 flex items-center justify-center p-4">' +
    '<div class="absolute inset-0 bg-black/60" data-close="1"></div>' +
    '<div class="relative bg-white dark:bg-slate-900 rounded-2xl shadow-2xl w-full ' +
    (wide ? 'max-w-3xl' : 'max-w-md') +
    ' max-h-[90vh] overflow-y-auto p-5 sm:p-6 fade-in">' +
    '<button class="absolute top-3 right-3 text-2xl leading-none text-slate-400 hover:text-slate-700 dark:hover:text-slate-200" data-close="1" aria-label="Close">×</button>' +
    html + '</div></div>';
  $$('[data-close]', root).forEach(el => el.addEventListener('click', closeModal));
}

function closeModal() { $('#modal-root').innerHTML = ''; }

function openAuthModal() {
  if (currentProfile()) { // sign out confirm
    openModal('<h2 class="text-xl font-bold mb-3">Sign out</h2>' +
      '<p class="text-sm text-slate-600 dark:text-slate-300 mb-5">Sign out of profile <strong>' + esc(currentProfile().name) + '</strong>? Your saved progress stays on this device.</p>' +
      '<div class="flex gap-2 justify-end"><button class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700" data-close="1">Cancel</button>' +
      '<button id="confirm-signout" class="px-4 py-2 rounded-lg bg-phfr-navy text-white font-semibold">Sign out</button></div>');
    $('#confirm-signout').addEventListener('click', () => {
      const s = getStore(); s.currentProfileId = null; saveStore(s);
      closeModal(); refreshHeader(); toast('Signed out.'); navTo(currentView);
    });
    return;
  }
  const s = getStore();
  const opts = s.profiles.map(p => '<option value="' + esc(p.id) + '">' + esc(p.name) + '</option>').join('');
  openModal(
    '<h2 class="text-xl font-bold mb-1">Sign in / Create profile</h2>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Profiles track quiz scores on this device. Quizzes require a signed-in profile.</p>' +
    '<div class="border-b border-slate-200 dark:border-slate-700 mb-4 flex gap-4 text-sm font-semibold">' +
    '<button id="tab-signin" class="pb-2 border-b-2 tab-active border-transparent">Sign in</button>' +
    '<button id="tab-create" class="pb-2 border-b-2 border-transparent text-slate-500">Create profile</button></div>' +
    '<div id="pane-signin">' +
    (s.profiles.length
      ? '<label class="block text-sm font-medium mb-1">Profile</label>' +
        '<select id="signin-profile" class="w-full mb-3 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' + opts + '</select>' +
        '<label class="block text-sm font-medium mb-1">4-digit PIN</label>' +
        '<input id="signin-pin" inputmode="numeric" maxlength="4" pattern="[0-9]*" class="w-full mb-4 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="••••">' +
        '<button id="do-signin" class="w-full py-2.5 rounded-lg bg-phfr-navy text-white font-semibold hover:brightness-110">Sign in</button>'
      : '<p class="text-sm text-slate-500 mb-3">No profiles yet — create one to get started.</p>') +
    '</div>' +
    '<div id="pane-create" class="hidden">' +
    '<label class="block text-sm font-medium mb-1">First name</label>' +
    '<input id="create-name" maxlength="40" class="w-full mb-3 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="e.g. Alex">' +
    '<label class="block text-sm font-medium mb-1">Choose a 4-digit PIN</label>' +
    '<input id="create-pin" inputmode="numeric" maxlength="4" pattern="[0-9]*" class="w-full mb-4 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800" placeholder="••••">' +
    '<button id="do-create" class="w-full py-2.5 rounded-lg bg-phfr-gold text-phfr-navy font-bold hover:brightness-105">Create profile</button>' +
    '<p class="text-xs text-slate-500 mt-3">Your PIN is hashed with a unique salt before it is stored. Never share it.</p></div>' +
    '<button id="guest-btn" class="w-full mt-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm">Continue as guest (browse only)</button>'
  );

  const tIn = $('#tab-signin'), tCr = $('#tab-create'), pIn = $('#pane-signin'), pCr = $('#pane-create');
  tIn.addEventListener('click', () => { tIn.classList.add('tab-active'); tCr.classList.remove('tab-active'); pIn.classList.remove('hidden'); pCr.classList.add('hidden'); });
  tCr.addEventListener('click', () => { tCr.classList.add('tab-active'); tIn.classList.remove('tab-active'); pCr.classList.remove('hidden'); pIn.classList.add('hidden'); });

  const doSign = $('#do-signin');
  if (doSign) doSign.addEventListener('click', async () => {
    const st = getStore();
    const prof = st.profiles.find(p => p.id === $('#signin-profile').value);
    const pin = $('#signin-pin').value.trim();
    if (!prof) return toast('Select a profile.', 'error');
    if (!/^\d{4}$/.test(pin)) return toast('Enter your 4-digit PIN.', 'error');
    const h = await sha256Hex(pin, prof.salt);
    if (h !== prof.pinHash) return toast('Incorrect PIN.', 'error');
    st.currentProfileId = prof.id; saveStore(st);
    closeModal(); refreshHeader(); toast('Welcome back, ' + prof.name + '!'); navTo(currentView);
  });

  $('#do-create').addEventListener('click', async () => {
    const name = $('#create-name').value.trim();
    const pin = $('#create-pin').value.trim();
    if (!name) return toast('Enter your first name.', 'error');
    if (!/^\d{4}$/.test(pin)) return toast('PIN must be exactly 4 digits.', 'error');
    const st = getStore();
    if (st.profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) return toast('That name is already taken.', 'error');
    const salt = makeSalt();
    const prof = { id: uid('u'), name: name, salt: salt, pinHash: await sha256Hex(pin, salt), created: Date.now() };
    st.profiles.push(prof); st.currentProfileId = prof.id; saveStore(st);
    closeModal(); refreshHeader(); toast('Profile created — welcome, ' + name + '!');
    scheduleCloudSync(); navTo(currentView);
  });

  $('#guest-btn').addEventListener('click', () => { closeModal(); toast('Guest mode — quizzes need a profile.'); });
}

/* ------------------------------ Home view -------------------------------- */
function homeCard(icon, title, desc, view, accent) {
  return '<button data-goto="' + view + '" class="card-hover text-left bg-white dark:bg-slate-900 rounded-2xl shadow p-5 border-t-4 ' + accent + '">' +
    '<div class="text-3xl mb-2">' + icon + '</div>' +
    '<h3 class="font-bold text-lg mb-1">' + title + '</h3>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400">' + desc + '</p></button>';
}

function renderHome(root) {
  const p = currentProfile();
  root.innerHTML =
    '<section class="mb-6 rounded-2xl overflow-hidden shadow bg-gradient-to-br from-phfr-navy to-slate-800 text-white p-6 sm:p-8">' +
    '<div class="flex items-center gap-4">' +
    '<img src="assets/dept-logo.png" alt="" class="h-16 w-16 sm:h-20 sm:w-20 object-contain rounded-full bg-white/10 p-1">' +
    '<div><h2 class="text-xl sm:text-2xl font-bold">SOP &amp; EMS Reference Hub</h2>' +
    '<p class="text-slate-300 text-sm mt-1">County SOPs · Department SOPs · EMS Medical SOPs (MOMs) · Interactive quizzes</p>' +
    (p ? '<p class="text-phfr-gold text-sm mt-2 font-semibold">Welcome back, ' + esc(p.name) + ' 👨‍🚒</p>'
       : '<p class="text-slate-300 text-sm mt-2">You are browsing as a guest. <button class="underline text-phfr-gold" id="hero-signin">Sign in</button> to take quizzes and track progress.</p>') +
    '</div></div></section>' +
    '<h2 class="text-lg font-bold mb-3">Quick Access</h2>' +
    '<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">' +
    homeCard('📋', 'County SOPs — 600 Series', 'Pinellas County fire service SOPs 600-01 through 600-27, reviewed May 2024.', 'library', 'border-blue-600') +
    homeCard('🏢', 'Department SOPs', 'Palm Harbor Fire Rescue internal SOPs, including SOP 100 incident notification.', 'library', 'border-phfr-gold') +
    homeCard('🚑', 'EMS Medical SOPs (MOMs)', 'Pinellas County EMS Medical Operations Manual reference and protocols.', 'library', 'border-red-600') +
    homeCard('📝', 'Start a Quiz', 'Test yourself on County SOPs, Department SOPs, MOMs, or a mixed review.', 'quiz', 'border-emerald-600') +
    homeCard('📊', 'My Progress', 'Scores, averages, and history for your profile.', 'progress', 'border-purple-600') +
    homeCard('🔐', 'Admin Portal', 'Training captains: manage users, documents, questions, and data.', 'admin', 'border-slate-500') +
    '</div>';

  $$('[data-goto]', root).forEach(b => b.addEventListener('click', () => {
    const v = b.dataset.goto;
    if (v === 'library') { navTo('library'); }
    else navTo(v);
  }));
  const hs = $('#hero-signin');
  if (hs) hs.addEventListener('click', openAuthModal);
}

/* ------------------------------ Library view ------------------------------ */
let libTab = 'county';
let libDocFilter = '';

function docRow(num, title, date, summary, key, link) {
  return '<button data-doc="' + key + '" class="w-full text-left bg-white dark:bg-slate-900 rounded-xl shadow p-4 card-hover border-l-4 border-phfr-navy dark:border-phfr-gold">' +
    '<div class="flex items-start justify-between gap-2">' +
    '<div class="min-w-0"><div class="font-mono text-xs text-slate-500 dark:text-slate-400">' + esc(num) + '</div>' +
    '<h4 class="font-bold leading-snug">' + esc(title) + '</h4>' +
    '<div class="text-xs text-slate-500 dark:text-slate-400 mt-0.5">' + esc(date) + '</div>' +
    (summary ? '<p class="text-sm text-slate-600 dark:text-slate-400 mt-1 line-clamp-2">' + esc(summary) + '</p>' : '') +
    (link ? '<div class="text-xs text-blue-600 dark:text-blue-400 mt-1 underline">Open current MOM document (pcemsomd.com) ↗</div>' : '') +
    '</div><div class="text-slate-300 dark:text-slate-600 text-xl shrink-0">›</div></div></button>';
}

function renderLibrary(root) {
  const store = getStore();
  const customDocs = store.customDocs || [];
  const tabs = [['county', 'County 600'], ['dept', 'Department'], ['moms', 'MOMs']];
  let listHtml = '';

  if (libTab === 'county') {
    listHtml = COUNTY_SOPS.map((d, i) => docRow(d[0], d[1], d[2], d[3], 'c' + i)).join('');
  } else if (libTab === 'dept') {
    listHtml = DEPT_SOPS.map((d, i) => docRow(d[0], d[1], d[2], d[3], 'd' + i)).join('');
  } else {
    listHtml = MOM_DOCS.map((d, i) => docRow(d[0], d[1], d[2], d[3], 'm' + i, true)).join('');
    if (customDocs.length) {
      listHtml += '<h3 class="font-bold mt-6 mb-2 text-sm uppercase tracking-wide text-slate-500">Uploaded references</h3>' +
        customDocs.map((d, i) => docRow('UPLOAD', d.title, fmtDate(d.date), d.text.slice(0, 220) + '…', 'u' + i)).join('');
    }
  }

  root.innerHTML =
    '<div class="flex items-center gap-3 mb-4">' +
    (libTab === 'moms'
      ? '<img src="assets/ems-logo.png" alt="Division of EMS logo" class="h-12 w-12 object-contain rounded-full bg-white p-0.5">'
      : '<img src="assets/dept-logo.png" alt="" class="h-12 w-12 object-contain rounded-full bg-white/10">') +
    '<div><h2 class="text-xl font-bold">Reference Library</h2>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400">Tap a document to read a study summary and quiz on it.</p></div></div>' +
    '<div class="flex gap-2 mb-4" role="tablist">' +
    tabs.map(t => '<button data-libtab="' + t[0] + '" class="flex-1 py-2 rounded-lg border-2 border-transparent bg-white dark:bg-slate-900 shadow text-sm font-semibold ' + (libTab === t[0] ? 'tab-active border-phfr-gold' : 'text-slate-500') + '">' + t[1] + '</button>').join('') +
    '</div>' +
    '<div class="space-y-3">' + listHtml + '</div>';

  $$('[data-libtab]', root).forEach(b => b.addEventListener('click', () => { libTab = b.dataset.libtab; renderLibrary(root); }));
  $$('[data-doc]', root).forEach(b => b.addEventListener('click', () => openDocModal(b.dataset.doc)));
}

function openDocModal(key) {
  const kind = key[0], idx = parseInt(key.slice(1), 10);
  let num, title, date, summary, cat = null, external = null;
  if (kind === 'c') { const d = COUNTY_SOPS[idx]; num = d[0]; title = d[1]; date = d[2]; summary = d[3]; cat = 'county'; }
  else if (kind === 'd') { const d = DEPT_SOPS[idx]; num = d[0]; title = d[1]; date = d[2]; summary = d[3]; cat = 'dept'; }
  else if (kind === 'm') { const d = MOM_DOCS[idx]; num = d[0]; title = d[1]; date = d[2]; summary = d[3]; cat = 'mom'; external = MOM_URL; }
  else { const d = getStore().customDocs[idx]; num = 'UPLOAD'; title = d.title; date = fmtDate(d.date); summary = d.text.slice(0, 1200); cat = d.cat || 'mom'; }

  openModal(
    '<div class="font-mono text-xs text-slate-500 mb-1">' + esc(num) + ' · ' + esc(date) + '</div>' +
    '<h2 class="text-xl font-bold mb-3 pr-6">' + esc(title) + '</h2>' +
    '<p class="text-sm text-slate-700 dark:text-slate-300 leading-relaxed mb-4">' + esc(summary) + '</p>' +
    (external
      ? '<a href="' + external + '" target="_blank" rel="noopener" class="block mb-4 px-4 py-2.5 rounded-lg bg-red-700 text-white text-sm font-semibold text-center hover:brightness-110">Open current MOM document (pcemsomd.com) ↗</a>' +
        '<p class="text-xs text-slate-500 mb-4">Link provided by the department; it may require updating if the county changes the file location. See README for how to update it.</p>'
      : '') +
    (cat
      ? '<button id="doc-quiz-btn" class="w-full py-2.5 rounded-lg bg-phfr-gold text-phfr-navy font-bold hover:brightness-105">Study &amp; Quiz on this topic</button>'
      : ''),
    true
  );
  // SOP filter: county/dept docs filter by SOP number; the MOM full-document and
  // uploaded references quiz on the whole category (or the doc title when the
  // admin has published generated questions carrying that title as their sop).
  let sopFilter = num;
  if (kind === 'm') sopFilter = null;
  else if (kind === 'u') {
    const upDoc = getStore().customDocs[idx];
    sopFilter = quizPool(cat, upDoc.title).length ? upDoc.title : null;
  }
  const qb = $('#doc-quiz-btn');
  if (qb) qb.addEventListener('click', () => { closeModal(); startQuizFlow(cat, 10, sopFilter); });
}

/* ------------------------------ Quiz engine ------------------------------- */
let quiz = null; // {cat, questions:[{...q, order:[...]}], idx, answers:[{picked, correct}], count}

function quizPool(cat, sopFilter) {
  let pool;
  if (cat === 'mixed') {
    pool = [].concat(allQuestions('county'), allQuestions('dept'), allQuestions('mom'));
  } else {
    pool = allQuestions(cat);
  }
  if (sopFilter) pool = pool.filter(q => q.sop === sopFilter);
  return pool;
}

function renderQuizSetup(root, presetCat, presetCount) {
  const p = currentProfile();
  const counts = { county: allQuestions('county').length, dept: allQuestions('dept').length, mom: allQuestions('mom').length };
  root.innerHTML =
    '<h2 class="text-xl font-bold mb-1">Quiz Setup</h2>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Pick a category and the number of questions.</p>' +
    (p ? '' : '<div class="mb-4 p-4 rounded-xl bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 text-sm">' +
      'Quizzes require a signed-in profile so your score can be saved. <button id="qs-signin" class="underline font-semibold text-amber-700 dark:text-amber-300">Sign in or create one</button>.</div>') +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 space-y-5 max-w-xl">' +
    '<div><label class="block text-sm font-semibold mb-2">Category</label><div class="grid grid-cols-2 gap-2" id="qs-cats">' +
    ['county', 'dept', 'mom', 'mixed'].map(c =>
      '<button data-cat="' + c + '" class="qs-cat px-3 py-2.5 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-sm font-medium text-left">' +
      esc(CAT_LABELS[c]) +
      (c !== 'mixed'
        ? '<span class="block text-xs font-normal text-slate-500">' + counts[c] + ' questions</span>'
        : '<span class="block text-xs font-normal text-slate-500">All categories</span>') +
      '</button>').join('') +
    '</div></div>' +
    '<div><label class="block text-sm font-semibold mb-2">Number of questions</label><div class="flex flex-wrap gap-2" id="qs-counts">' +
    [5, 10, 15, 25, 50, 100].map(n => '<button data-n="' + n + '" class="qs-n px-4 py-2 rounded-lg border-2 border-slate-200 dark:border-slate-700 text-sm font-semibold">' + n + '</button>').join('') +
    '</div><p id="qs-note" class="text-xs text-slate-500 mt-2"></p></div>' +
    '<button id="qs-start" class="w-full py-3 rounded-xl bg-phfr-navy text-white font-bold text-lg hover:brightness-110 disabled:opacity-40" ' + (p ? '' : 'disabled') + '>Start Quiz</button>' +
    '</div>';

  let selCat = presetCat || 'county', selN = presetCount || 10;
  const paint = () => {
    $$('.qs-cat', root).forEach(b => b.classList.toggle('tab-active', b.dataset.cat === selCat));
    $$('.qs-n', root).forEach(b => b.classList.toggle('tab-active', parseInt(b.dataset.n, 10) === selN));
    const pool = quizPool(selCat).length;
    $('#qs-note', root).textContent = pool < selN
      ? 'Only ' + pool + ' questions available in this bank — the quiz will use all of them.'
      : pool + ' questions available; ' + selN + ' will be drawn at random.';
  };
  $$('.qs-cat', root).forEach(b => b.addEventListener('click', () => { selCat = b.dataset.cat; paint(); }));
  $$('.qs-n', root).forEach(b => b.addEventListener('click', () => { selN = parseInt(b.dataset.n, 10); paint(); }));
  paint();
  const si = $('#qs-signin', root);
  if (si) si.addEventListener('click', openAuthModal);
  $('#qs-start', root).addEventListener('click', () => startQuizFlow(selCat, selN, null));
}

/** Begin a quiz: category, requested count, optional SOP filter (from Library). */
function startQuizFlow(cat, n, sopFilter) {
  if (!currentProfile()) { openAuthModal(); return toast('Sign in to take a quiz.', 'error'); }
  const pool = quizPool(cat, sopFilter);
  if (!pool.length) return toast('No questions available for this selection.', 'error');
  const picked = shuffle(pool).slice(0, Math.min(n, pool.length)).map(q => {
    const order = shuffle([0, 1, 2, 3]);
    return { id: q.id, cat: q.cat, sop: q.sop, q: q.q, o: q.o, e: q.e, order: order, answer: order.indexOf(q.a) };
  });
  quiz = { cat: cat, sopFilter: sopFilter, requested: n, questions: picked, idx: 0, answers: [] };
  renderQuizQuestion($('#view'));
}

function renderQuizQuestion(root) {
  const q = quiz.questions[quiz.idx];
  const total = quiz.questions.length;
  root.innerHTML =
    '<div class="max-w-2xl mx-auto">' +
    '<div class="flex items-center justify-between mb-2 text-sm">' +
    '<span class="font-semibold">Question ' + (quiz.idx + 1) + ' of ' + total + '</span>' +
    '<span class="text-slate-500">' + esc(CAT_LABELS[quiz.cat]) + (quiz.sopFilter ? ' · ' + esc(quiz.sopFilter) : '') + '</span></div>' +
    '<div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 mb-5 overflow-hidden">' +
    '<div class="h-full bg-phfr-gold bar" style="width:' + Math.round((quiz.idx / total) * 100) + '%"></div></div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 sm:p-6">' +
    '<div class="font-mono text-xs text-slate-500 mb-2">' + esc(q.sop || '') + '</div>' +
    '<h3 class="text-lg font-bold mb-4 leading-snug">' + esc(q.q) + '</h3>' +
    '<div class="space-y-2" id="q-opts">' +
    q.order.map((origIdx, dispIdx) =>
      '<button data-opt="' + dispIdx + '" class="opt-btn w-full text-left px-4 py-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 hover:border-phfr-gold text-sm font-medium">' +
      '<span class="font-bold mr-2">' + 'ABCD'[dispIdx] + '.</span>' + esc(q.o[origIdx]) + '</button>').join('') +
    '</div>' +
    '<div id="q-feedback" class="mt-4"></div>' +
    '<div class="flex justify-between mt-5">' +
    '<button id="q-quit" class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm">End quiz</button>' +
    '<button id="q-next" class="px-6 py-2 rounded-lg bg-phfr-navy text-white text-sm font-bold hidden">Next →</button>' +
    '</div></div></div>';

  $$('#q-opts [data-opt]', root).forEach(btn => btn.addEventListener('click', () => {
    if ($('#q-next', root) && !$('#q-next', root).classList.contains('hidden')) return; // already answered
    const picked = parseInt(btn.dataset.opt, 10);
    const correct = picked === q.answer;
    quiz.answers.push({ id: q.id, picked: picked, correct: correct });
    $$('#q-opts [data-opt]', root).forEach(b => {
      const i = parseInt(b.dataset.opt, 10);
      b.disabled = true;
      if (i === q.answer) b.classList.add('border-green-600', 'bg-green-50', 'dark:bg-green-900/30');
      else if (i === picked) b.classList.add('border-red-600', 'bg-red-50', 'dark:bg-red-900/30');
      else b.classList.add('opacity-50');
    });
    $('#q-feedback', root).innerHTML =
      '<div class="p-3 rounded-xl text-sm ' + (correct ? 'bg-green-100 dark:bg-green-900/40 text-green-900 dark:text-green-200' : 'bg-red-100 dark:bg-red-900/40 text-red-900 dark:text-red-200') + '">' +
      '<strong>' + (correct ? '✓ Correct!' : '✗ Incorrect — the correct answer is ' + 'ABCD'[q.answer] + '.') + '</strong>' +
      '<p class="mt-1">' + esc(q.e) + '</p></div>';
    const nx = $('#q-next', root);
    nx.classList.remove('hidden');
    nx.textContent = quiz.idx + 1 >= quiz.questions.length ? 'See results →' : 'Next →';
  }));

  $('#q-next', root).addEventListener('click', () => {
    if (quiz.idx + 1 >= quiz.questions.length) finishQuiz();
    else { quiz.idx++; renderQuizQuestion($('#view')); }
  });
  $('#q-quit', root).addEventListener('click', () => {
    if (quiz.answers.length && confirm('End this quiz early? Answered questions will be scored.')) finishQuiz(true);
    else if (!quiz.answers.length) { quiz = null; navTo('quiz'); }
  });
}

function finishQuiz(early) {
  const total = quiz.answers.length;
  if (!total) { quiz = null; navTo('quiz'); return; }
  const correct = quiz.answers.filter(a => a.correct).length;
  const score = Math.round((correct / total) * 100);
  const pass = score >= 80;
  const prof = currentProfile();
  const missedIds = quiz.answers.filter(a => !a.correct).map(a => a.id);
  // Self-contained per-question snapshot so any past test can be reviewed later,
  // even if the question bank changes. `options` are in the order shown; `picked`
  // and `answer` are indexes into that displayed order.
  const detail = quiz.answers.map(a => {
    const q = quiz.questions.find(x => x.id === a.id);
    if (!q) return null;
    return {
      id: q.id, q: q.q, options: q.order.map(oi => q.o[oi]),
      picked: a.picked, answer: q.answer, correct: a.correct,
      e: q.e, cat: q.cat, sop: q.sop || null
    };
  }).filter(Boolean);
  const record = {
    id: uid('r'), profileId: prof.id, date: Date.now(), category: quiz.cat,
    sopFilter: quiz.sopFilter || null, requested: quiz.requested,
    total: total, correct: correct, score: score, missed: missedIds,
    detail: detail, early: !!early
  };
  const s = getStore();
  s.results.push(record); saveStore(s);
  scheduleCloudSync();

  const missedQs = missedIds.map(id => quiz.questions.find(q => q.id === id)).filter(Boolean);
  const root = $('#view');
  root.innerHTML =
    '<div class="max-w-2xl mx-auto text-center">' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-6 sm:p-8 mb-4">' +
    '<div class="text-5xl mb-3">' + (pass ? '🎉' : '📝') + '</div>' +
    '<h2 class="text-2xl font-bold mb-1">' + score + '%</h2>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-2">' + correct + ' of ' + total + ' correct · ' + esc(CAT_LABELS[quiz.cat]) + '</p>' +
    '<span class="inline-block px-4 py-1.5 rounded-full text-sm font-bold ' + (pass ? 'bg-green-600 text-white' : 'bg-amber-500 text-white') + '">' +
    (pass ? 'PASS — 80% or better' : 'Below 80% — keep studying') + '</span>' +
    (quiz.requested > total ? '<p class="text-xs text-slate-500 mt-3">Note: the bank held ' + total + ' questions, fewer than the ' + quiz.requested + ' requested — all available questions were used.</p>' : '') +
    '</div>' +
    (missedQs.length
      ? '<div class="text-left bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-3">Review missed questions (' + missedQs.length + ')</h3><div class="space-y-4">' +
        missedQs.map(q =>
          '<div class="border-l-4 border-red-500 pl-3"><p class="text-sm font-semibold">' + esc(q.q) + '</p>' +
          '<p class="text-sm text-green-700 dark:text-green-300 mt-1"><strong>Correct:</strong> ' + esc(q.o[q.order[q.answer]]) + '</p>' +
          '<p class="text-xs text-slate-500 mt-1">' + esc(q.e) + '</p></div>').join('') +
        '</div></div>'
      : '<div class="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-2xl p-5 mb-4 text-sm font-semibold text-green-800 dark:text-green-200">Perfect score — nothing to review! 💪</div>') +
    '<div class="flex gap-2 justify-center">' +
    '<button id="res-retry" class="px-5 py-2.5 rounded-xl bg-phfr-navy text-white font-bold">Retake quiz</button>' +
    '<button id="res-progress" class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">My progress</button>' +
    '<button id="res-home" class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">Home</button>' +
    '</div></div>';

  const doneCat = quiz.cat, doneN = quiz.requested;
  quiz = null;
  $('#res-retry').addEventListener('click', () => startQuizFlow(doneCat, doneN, null));
  $('#res-progress').addEventListener('click', () => navTo('progress'));
  $('#res-home').addEventListener('click', () => navTo('home'));
}

/* ------------------------------ Progress view ----------------------------- */
function renderProgress(root) {
  const p = currentProfile();
  if (!p) {
    root.innerHTML = '<div class="max-w-xl mx-auto text-center bg-white dark:bg-slate-900 rounded-2xl shadow p-8">' +
      '<div class="text-4xl mb-3">📊</div><h2 class="text-xl font-bold mb-2">My Progress</h2>' +
      '<p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Sign in to see your quiz history, averages, and per-category stats.</p>' +
      '<button id="pg-signin" class="px-5 py-2.5 rounded-xl bg-phfr-navy text-white font-bold">Sign in / Create profile</button></div>';
    $('#pg-signin').addEventListener('click', openAuthModal);
    return;
  }
  const res = profileResults(p.id);
  const total = res.length;
  const avg = total ? Math.round(res.reduce((a, r) => a + r.score, 0) / total) : 0;
  const best = total ? Math.max.apply(null, res.map(r => r.score)) : 0;
  const cats = ['county', 'dept', 'mom', 'mixed'];
  const catStats = cats.map(c => {
    const rr = res.filter(r => r.category === c);
    return { cat: c, n: rr.length, avg: rr.length ? Math.round(rr.reduce((a, r) => a + r.score, 0) / rr.length) : null };
  }).filter(c => c.n > 0);

  // Simple SVG bar chart of last 12 scores
  const last = res.slice(0, 12).reverse();
  let chart = '<p class="text-sm text-slate-500">No quizzes yet — take one to see your trend.</p>';
  if (last.length) {
    const W = 560, H = 160, pad = 30, bw = Math.min(40, (W - pad * 2) / last.length - 8);
    let bars = '';
    last.forEach((r, i) => {
      const x = pad + i * ((W - pad * 2) / last.length) + (((W - pad * 2) / last.length) - bw) / 2;
      const h = Math.max(4, (r.score / 100) * (H - pad - 20));
      const y = H - pad - h;
      const color = r.score >= 80 ? '#16a34a' : (r.score >= 60 ? '#d97706' : '#dc2626');
      bars += '<rect x="' + x.toFixed(1) + '" y="' + y.toFixed(1) + '" width="' + bw.toFixed(1) + '" height="' + h.toFixed(1) + '" rx="3" fill="' + color + '">' +
        '<title>' + esc(CAT_LABELS[r.category]) + ' — ' + r.score + '% on ' + fmtDate(r.date) + '</title></rect>' +
        '<text x="' + (x + bw / 2).toFixed(1) + '" y="' + (H - pad + 16) + '" text-anchor="middle" font-size="10" fill="currentColor">' + r.score + '</text>';
    });
    chart = '<svg viewBox="0 0 ' + W + ' ' + H + '" class="w-full text-slate-500" role="img" aria-label="Recent quiz scores bar chart">' +
      '<line x1="' + pad + '" y1="' + (H - pad) + '" x2="' + (W - 10) + '" y2="' + (H - pad) + '" stroke="currentColor" stroke-width="1"/>' +
      '<line x1="' + pad + '" y1="' + (H - pad - (H - pad - 20) * 0.8) + '" x2="' + (W - 10) + '" y2="' + (H - pad - (H - pad - 20) * 0.8) + '" stroke="#dc2626" stroke-dasharray="4" stroke-width="1"/>' +
      '<text x="' + (W - 12) + '" y="' + (H - pad - (H - pad - 20) * 0.8 - 4) + '" text-anchor="end" font-size="10" fill="#dc2626">80% pass</text>' +
      bars + '</svg>';
  }

  root.innerHTML =
    '<h2 class="text-xl font-bold mb-1">My Progress</h2>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-4">Profile: <strong>' + esc(p.name) + '</strong></p>' +
    '<div class="grid grid-cols-3 gap-3 mb-4">' +
    statCard('📝', total, 'Quizzes taken') + statCard('📈', avg + '%', 'Average score') + statCard('🏆', best + '%', 'Best score') +
    '</div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-2">Recent scores</h3>' + chart + '</div>' +
    (catStats.length ? '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-3">Per-category averages</h3><div class="space-y-2">' +
      catStats.map(c =>
        '<div><div class="flex justify-between text-sm mb-1"><span>' + esc(CAT_LABELS[c.cat]) + ' <span class="text-slate-500">(' + c.n + ')</span></span><strong>' + c.avg + '%</strong></div>' +
        '<div class="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden"><div class="h-full bar ' + (c.avg >= 80 ? 'bg-green-600' : 'bg-amber-500') + '" style="width:' + c.avg + '%"></div></div></div>').join('') +
      '</div></div>' : '') +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-1">History</h3>' +
    '<p class="text-xs text-slate-500 mb-3">Tap any row to review that test question-by-question.</p>' +
    (res.length
      ? '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700"><th class="py-2 pr-2">Date</th><th class="py-2 pr-2">Category</th><th class="py-2 pr-2">Score</th><th class="py-2 pr-2">Result</th><th class="py-2"></th></tr></thead><tbody>' +
        res.map(r => '<tr data-rid="' + r.id + '" title="Tap to review this test" class="border-b border-slate-100 dark:border-slate-800 cursor-pointer hover:bg-slate-50 dark:hover:bg-slate-800/60"><td class="py-2 pr-2 whitespace-nowrap">' + fmtDate(r.date) + '</td><td class="py-2 pr-2">' + esc(CAT_LABELS[r.category]) + (r.sopFilter ? ' <span class="text-xs text-slate-500">(' + esc(r.sopFilter) + ')</span>' : '') + '</td><td class="py-2 pr-2 font-bold">' + r.score + '% <span class="font-normal text-slate-500">(' + r.correct + '/' + r.total + ')</span></td><td class="py-2 pr-2">' + (r.score >= 80 ? '<span class="text-green-700 dark:text-green-400 font-semibold">Pass</span>' : '<span class="text-amber-700 dark:text-amber-400 font-semibold">Study</span>') + '</td><td class="py-2 text-phfr-navy dark:text-sky-300 font-semibold whitespace-nowrap">Review ›</td></tr>').join('') +
        '</tbody></table></div>'
      : '<p class="text-sm text-slate-500">No quiz history yet.</p>') +
    '</div>' +
    (res.length ? '<button id="clear-history" class="text-sm text-red-600 dark:text-red-400 underline">Clear my quiz history</button>' : '');

  const ch = $('#clear-history');
  if (ch) ch.addEventListener('click', () => {
    if (!confirm('Delete all quiz history for ' + p.name + '? This cannot be undone.')) return;
    const s = getStore();
    s.results = s.results.filter(r => r.profileId !== p.id);
    saveStore(s); scheduleCloudSync(); toast('History cleared.'); renderProgress(root);
  });
  $$('tr[data-rid]', root).forEach(tr => tr.addEventListener('click', () => navTo('test', tr.dataset.rid)));
}

/* --------------------------- Single test detail --------------------------- */
function findQuestionById(id) {
  const all = [].concat(allQuestions('county'), allQuestions('dept'), allQuestions('mom'));
  return all.find(q => q.id === id) || null;
}

function renderTestDetail(root, rid) {
  const s = getStore();
  const p = currentProfile();
  const r = s.results.find(x => x.id === rid);
  if (!r || !p || r.profileId !== p.id) {
    toast('Test not found.', 'error');
    navTo('progress');
    return;
  }
  const pass = r.score >= 80;
  let body = '';
  let qCount = 0;
  if (r.detail && r.detail.length) {
    qCount = r.detail.length;
    body = r.detail.map((d, i) =>
      '<div class="rounded-xl border p-4 ' + (d.correct
        ? 'border-green-300 dark:border-green-800 bg-green-50/60 dark:bg-green-900/10'
        : 'border-red-300 dark:border-red-800 bg-red-50/60 dark:bg-red-900/10') + '">' +
      '<p class="text-sm font-semibold mb-2">' + (i + 1) + '. ' + esc(d.q) + ' ' +
      (d.correct
        ? '<span class="text-green-700 dark:text-green-400 font-bold">✓</span>'
        : '<span class="text-red-600 dark:text-red-400 font-bold">✗</span>') + '</p>' +
      '<div class="space-y-1.5">' + d.options.map((opt, oi) => {
        let cls = 'border-slate-200 dark:border-slate-700';
        let tag = '';
        if (oi === d.answer) {
          cls = 'border-green-600 bg-green-100/70 dark:bg-green-900/30';
          tag = '<span class="text-xs font-bold text-green-700 dark:text-green-300 ml-2">✓ Correct answer</span>';
        }
        if (oi === d.picked && !d.correct) {
          cls = 'border-red-600 bg-red-100/70 dark:bg-red-900/30';
          tag = '<span class="text-xs font-bold text-red-700 dark:text-red-300 ml-2">Your answer</span>';
        } else if (oi === d.picked && d.correct) {
          tag = '<span class="text-xs font-bold text-green-700 dark:text-green-300 ml-2">Your answer ✓</span>';
        }
        return '<div class="text-sm border rounded-lg px-3 py-1.5 ' + cls + '">' + esc(opt) + tag + '</div>';
      }).join('') + '</div>' +
      (d.e ? '<p class="text-xs text-slate-500 mt-2">' + esc(d.e) + '</p>' : '') +
      '</div>').join('');
  } else {
    // Legacy records (saved before per-question snapshots): missed-only review.
    const missedQs = (r.missed || []).map(findQuestionById).filter(Boolean);
    qCount = missedQs.length;
    body = missedQs.length
      ? missedQs.map(q =>
        '<div class="border-l-4 border-red-500 pl-3"><p class="text-sm font-semibold">' + esc(q.q) + '</p>' +
        '<p class="text-sm text-green-700 dark:text-green-300 mt-1"><strong>Correct:</strong> ' + esc(q.o[q.a]) + '</p>' +
        (q.e ? '<p class="text-xs text-slate-500 mt-1">' + esc(q.e) + '</p>' : '') + '</div>').join('')
      : '<p class="text-sm text-slate-500">Question details are not available for this older test — only tests taken from now on store the full question-by-question review.</p>';
  }

  root.innerHTML =
    '<button id="td-back" class="text-sm text-phfr-navy dark:text-sky-300 font-semibold mb-3">← Back to My Progress</button>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-6 mb-4 text-center">' +
    '<h2 class="text-xl font-bold mb-1">Test Review</h2>' +
    '<p class="text-sm text-slate-500 mb-3">' + fmtDate(r.date) + ' · ' + esc(CAT_LABELS[r.category] || r.category) +
    (r.sopFilter ? ' · ' + esc(r.sopFilter) : '') + (r.early ? ' · ended early' : '') + '</p>' +
    '<div class="text-4xl font-extrabold mb-1">' + r.score + '%</div>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">' + r.correct + ' of ' + r.total + ' correct</p>' +
    '<span class="inline-block px-4 py-1.5 rounded-full text-sm font-bold ' + (pass ? 'bg-green-600 text-white' : 'bg-amber-500 text-white') + '">' +
    (pass ? 'PASS' : 'Below 80% — keep studying') + '</span></div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-3">Question-by-question (' + qCount + ')</h3>' +
    '<div class="space-y-3">' + body + '</div></div>' +
    '<div class="flex gap-2 justify-center"><button id="td-retake" class="px-5 py-2.5 rounded-xl bg-phfr-navy text-white font-bold">Retake this quiz</button></div>';

  $('#td-back', root).addEventListener('click', () => navTo('progress'));
  $('#td-retake', root).addEventListener('click', () => startQuizFlow(r.category, r.requested, r.sopFilter || null));
}

function statCard(icon, val, label) {
  return '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-4 text-center">' +
    '<div class="text-2xl">' + icon + '</div><div class="text-2xl font-bold">' + val + '</div>' +
    '<div class="text-xs text-slate-500">' + label + '</div></div>';
}

/* ------------------------------ Admin portal ------------------------------ */
let adminAuthed = false;
let adminTab = 'dashboard';

async function renderAdmin(root) {
  const s = getStore();
  if (!s.admin) { // first-run: force password creation
    root.innerHTML =
      '<div class="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow p-6">' +
      '<div class="text-4xl mb-2 text-center">🔐</div>' +
      '<h2 class="text-xl font-bold mb-2 text-center">Set up the Admin Portal</h2>' +
      '<p class="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">First visit: create an admin password for training captains. Minimum 8 characters. It is stored as a salted hash on this device.</p>' +
      '<label class="block text-sm font-medium mb-1">New admin password</label>' +
      '<input id="adm-new" type="password" class="w-full mb-3 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' +
      '<label class="block text-sm font-medium mb-1">Confirm password</label>' +
      '<input id="adm-confirm" type="password" class="w-full mb-4 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' +
      '<button id="adm-create" class="w-full py-2.5 rounded-lg bg-phfr-navy text-white font-bold">Create admin password</button></div>';
    $('#adm-create').addEventListener('click', async () => {
      const a = $('#adm-new').value, b = $('#adm-confirm').value;
      if (a.length < 8) return toast('Password must be at least 8 characters.', 'error');
      if (a !== b) return toast('Passwords do not match.', 'error');
      const st = getStore();
      const salt = makeSalt();
      st.admin = { salt: salt, hash: await sha256Hex(a, salt), created: Date.now() };
      saveStore(st); adminAuthed = true;
      toast('Admin password created.'); renderAdmin(root);
    });
    return;
  }
  if (!adminAuthed) {
    root.innerHTML =
      '<div class="max-w-md mx-auto bg-white dark:bg-slate-900 rounded-2xl shadow p-6">' +
      '<div class="text-4xl mb-2 text-center">🔐</div>' +
      '<h2 class="text-xl font-bold mb-2 text-center">Admin Portal</h2>' +
      '<p class="text-sm text-slate-600 dark:text-slate-400 mb-4 text-center">Restricted to training captains.</p>' +
      '<label class="block text-sm font-medium mb-1">Admin password</label>' +
      '<input id="adm-pass" type="password" class="w-full mb-4 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' +
      '<button id="adm-login" class="w-full py-2.5 rounded-lg bg-phfr-navy text-white font-bold">Log in</button></div>';
    const tryLogin = async () => {
      const st = getStore();
      const h = await sha256Hex($('#adm-pass').value, st.admin.salt);
      if (h === st.admin.hash) { adminAuthed = true; toast('Welcome, admin.'); renderAdmin(root); }
      else toast('Incorrect password.', 'error');
    };
    $('#adm-login').addEventListener('click', tryLogin);
    $('#adm-pass').addEventListener('keydown', e => { if (e.key === 'Enter') tryLogin(); });
    return;
  }
  // Authenticated admin shell
  const tabs = [['dashboard', '📊 Dashboard'], ['users', '👥 Users'], ['docs', '📄 Documents'], ['data', '💾 Data']];
  root.innerHTML =
    '<div class="flex items-center justify-between mb-4"><h2 class="text-xl font-bold">Admin Portal</h2>' +
    '<button id="adm-lock" class="text-sm px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-700">Lock</button></div>' +
    '<div class="flex gap-2 mb-4 overflow-x-auto">' +
    tabs.map(t => '<button data-admtab="' + t[0] + '" class="px-4 py-2 rounded-lg text-sm font-semibold whitespace-nowrap ' +
      (adminTab === t[0] ? 'bg-phfr-navy text-white' : 'bg-white dark:bg-slate-900 shadow') + '">' + t[1] + '</button>').join('') +
    '</div><div id="adm-body"></div>';
  $('#adm-lock').addEventListener('click', () => { adminAuthed = false; toast('Admin portal locked.'); renderAdmin(root); });
  $$('[data-admtab]', root).forEach(b => b.addEventListener('click', () => { adminTab = b.dataset.admtab; renderAdmin(root); }));
  const body = $('#adm-body', root);
  if (adminTab === 'dashboard') renderAdminDashboard(body);
  else if (adminTab === 'users') renderAdminUsers(body);
  else if (adminTab === 'docs') renderAdminDocs(body);
  else renderAdminData(body);
}

function renderAdminDashboard(body) {
  const s = getStore();
  if (!s.profiles.length) { body.innerHTML = '<p class="text-sm text-slate-500">No user profiles yet.</p>'; return; }
  body.innerHTML = '<div class="space-y-3">' + s.profiles.map(p => {
    const r = profileResults(p.id);
    const avg = r.length ? Math.round(r.reduce((a, x) => a + x.score, 0) / r.length) : '—';
    const last = r.length ? fmtDate(r[0].date) : 'Never';
    return '<div class="bg-white dark:bg-slate-900 rounded-xl shadow p-4">' +
      '<button class="w-full flex items-center justify-between text-left" data-expand="' + esc(p.id) + '">' +
      '<span class="font-bold">' + esc(p.name) + '</span>' +
      '<span class="text-sm text-slate-500">' + r.length + ' quizzes · avg ' + avg + (avg === '—' ? '' : '%') + ' · last: ' + esc(last) + ' <span class="ml-1">▾</span></span></button>' +
      '<div class="hidden mt-3" id="exp-' + esc(p.id) + '">' +
      (r.length
        ? '<div class="overflow-x-auto"><table class="w-full text-sm"><thead><tr class="text-left text-xs uppercase text-slate-500 border-b border-slate-200 dark:border-slate-700"><th class="py-1 pr-2">Date</th><th class="py-1 pr-2">Category</th><th class="py-1 pr-2">Score</th><th class="py-1">Missed</th></tr></thead><tbody>' +
          r.map(x => '<tr class="border-b border-slate-100 dark:border-slate-800"><td class="py-1 pr-2 whitespace-nowrap">' + fmtDate(x.date) + '</td><td class="py-1 pr-2">' + esc(CAT_LABELS[x.category]) + '</td><td class="py-1 pr-2 font-bold">' + x.score + '%</td><td class="py-1">' + x.missed.length + '</td></tr>').join('') +
          '</tbody></table></div>'
        : '<p class="text-sm text-slate-500">No quizzes taken yet.</p>') +
      '</div></div>';
  }).join('') + '</div>';
  $$('[data-expand]', body).forEach(b => b.addEventListener('click', () => {
    $('#exp-' + b.dataset.expand).classList.toggle('hidden');
  }));
}

function renderAdminUsers(body) {
  const s = getStore();
  body.innerHTML =
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-3">Add member</h3>' +
    '<div class="flex flex-col sm:flex-row gap-2">' +
    '<input id="au-name" maxlength="40" placeholder="First name" class="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' +
    '<input id="au-pin" inputmode="numeric" maxlength="4" placeholder="4-digit PIN" class="sm:w-36 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' +
    '<button id="au-add" class="px-5 py-2 rounded-lg bg-phfr-navy text-white font-bold">Add</button></div></div>' +
    '<div class="space-y-2">' + s.profiles.map(p =>
      '<div class="bg-white dark:bg-slate-900 rounded-xl shadow p-4 flex items-center justify-between gap-2">' +
      '<div><div class="font-bold">' + esc(p.name) + '</div><div class="text-xs text-slate-500">Created ' + fmtDate(p.created) + ' · ' + profileResults(p.id).length + ' quizzes</div></div>' +
      '<div class="flex gap-2">' +
      '<button data-reset="' + esc(p.id) + '" class="text-xs px-3 py-1.5 rounded-lg border border-amber-500 text-amber-700 dark:text-amber-400 font-semibold">Reset PIN</button>' +
      '<button data-del="' + esc(p.id) + '" class="text-xs px-3 py-1.5 rounded-lg border border-red-500 text-red-600 dark:text-red-400 font-semibold">Remove</button>' +
      '</div></div>').join('') + '</div>';

  $('#au-add').addEventListener('click', async () => {
    const name = $('#au-name').value.trim(), pin = $('#au-pin').value.trim();
    if (!name) return toast('Enter a name.', 'error');
    if (!/^\d{4}$/.test(pin)) return toast('PIN must be exactly 4 digits.', 'error');
    const st = getStore();
    if (st.profiles.some(p => p.name.toLowerCase() === name.toLowerCase())) return toast('Name already exists.', 'error');
    const salt = makeSalt();
    st.profiles.push({ id: uid('u'), name: name, salt: salt, pinHash: await sha256Hex(pin, salt), created: Date.now() });
    saveStore(st); scheduleCloudSync(); toast('Added ' + name + '.'); renderAdminUsers(body);
  });
  $$('[data-reset]', body).forEach(b => b.addEventListener('click', async () => {
    const pin = prompt('Enter a new 4-digit PIN for this member:');
    if (pin === null) return;
    if (!/^\d{4}$/.test(pin.trim())) return toast('PIN must be exactly 4 digits.', 'error');
    const st = getStore();
    const prof = st.profiles.find(p => p.id === b.dataset.reset);
    if (!prof) return;
    prof.salt = makeSalt();
    prof.pinHash = await sha256Hex(pin.trim(), prof.salt);
    saveStore(st); scheduleCloudSync(); toast('PIN reset for ' + prof.name + '.');
  }));
  $$('[data-del]', body).forEach(b => b.addEventListener('click', () => {
    const st = getStore();
    const prof = st.profiles.find(p => p.id === b.dataset.del);
    if (!prof) return;
    if (!confirm('Remove ' + prof.name + ' and all of their quiz history?')) return;
    st.profiles = st.profiles.filter(p => p.id !== prof.id);
    st.results = st.results.filter(r => r.profileId !== prof.id);
    if (st.currentProfileId === prof.id) st.currentProfileId = null;
    saveStore(st); scheduleCloudSync(); refreshHeader(); toast('Removed ' + prof.name + '.'); renderAdminUsers(body);
  }));
}

/* ------------------------- Admin: documents & Q-gen ----------------------- */
let pendingQuestions = []; // generated, awaiting review

function renderAdminDocs(body) {
  const s = getStore();
  const builtIn = [
    ['County SOPs (600 series)', COUNTY_SOPS.length + ' documents', 'county'],
    ['Department SOPs', DEPT_SOPS.length + ' documents', 'dept'],
    ['EMS MOMs', MOM_DOCS.length + ' documents', 'mom']
  ];
  body.innerHTML =
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-2">Built-in documents</h3>' +
    '<ul class="text-sm space-y-1">' + builtIn.map(b => '<li>📄 <strong>' + b[0] + '</strong> — ' + b[1] + '</li>').join('') + '</ul>' +
    '<p class="text-xs text-slate-500 mt-2">Built-in SOP listings are part of the app bundle. Uploaded references below are stored on this device.</p></div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-2">Upload reference document</h3>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">Upload a <strong>.txt</strong> or <strong>.md</strong> file, or a <strong>.pdf</strong> (text is extracted in your browser). The text is saved so crews can study it and you can generate quiz questions from it.</p>' +
    '<div class="flex flex-col sm:flex-row gap-2 mb-2">' +
    '<input id="doc-title" maxlength="120" placeholder="Document title (e.g. SOP 600-30 Draft)" class="flex-1 px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' +
    '<select id="doc-cat" class="px-3 py-2 rounded-lg border border-slate-300 dark:border-slate-700 bg-white dark:bg-slate-800">' +
    '<option value="county">County SOPs</option><option value="dept">Department SOPs</option><option value="mom">MOMs</option></select></div>' +
    '<input id="doc-file" type="file" accept=".txt,.md,.pdf" class="text-sm mb-2">' +
    '<div id="doc-status" class="text-sm text-slate-500"></div></div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-3">Uploaded references (' + s.customDocs.length + ')</h3>' +
    (s.customDocs.length
      ? '<div class="space-y-2">' + s.customDocs.map((d, i) =>
        '<div class="border border-slate-200 dark:border-slate-700 rounded-xl p-3"><div class="flex items-center justify-between gap-2">' +
        '<div class="min-w-0"><div class="font-bold text-sm truncate">' + esc(d.title) + '</div>' +
        '<div class="text-xs text-slate-500">' + esc(CAT_LABELS[d.cat] || d.cat) + ' · ' + d.text.length + ' chars · ' + fmtDate(d.date) + '</div></div>' +
        '<div class="flex gap-2 shrink-0"><button data-viewdoc="' + i + '" class="text-xs px-3 py-1.5 rounded-lg border border-slate-300 dark:border-slate-600">View</button>' +
        '<button data-gendoc="' + i + '" class="text-xs px-3 py-1.5 rounded-lg bg-phfr-gold text-phfr-navy font-bold">Generate questions</button>' +
        '<button data-deldoc="' + i + '" class="text-xs px-3 py-1.5 rounded-lg border border-red-500 text-red-600 dark:text-red-400">Delete</button></div></div></div>').join('') + '</div>'
      : '<p class="text-sm text-slate-500">No uploads yet.</p>') + '</div>' +
    '<div id="qgen-area"></div>';

  $('#doc-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    const title = $('#doc-title').value.trim() || f.name.replace(/\.[^.]+$/, '');
    const cat = $('#doc-cat').value;
    const status = $('#doc-status');
    status.textContent = 'Reading ' + f.name + '…';
    try {
      let text = '';
      if (/\.pdf$/i.test(f.name)) text = await extractPdfText(f, status);
      else text = await f.text();
      text = text.replace(/\s+/g, ' ').trim();
      if (text.length < 50) { status.textContent = 'Could not extract enough text from that file.'; return; }
      const st = getStore();
      st.customDocs.push({ id: uid('doc'), title: title, cat: cat, text: text.slice(0, 60000), date: Date.now() });
      saveStore(st);
      status.textContent = 'Saved "' + title + '" (' + text.length + ' characters).';
      toast('Document uploaded.'); renderAdminDocs(body);
    } catch (err) { console.error(err); status.textContent = 'Failed to read file: ' + err.message; }
  });

  $$('[data-viewdoc]', body).forEach(b => b.addEventListener('click', () => {
    const d = getStore().customDocs[parseInt(b.dataset.viewdoc, 10)];
    openModal('<h2 class="text-xl font-bold mb-3 pr-6">' + esc(d.title) + '</h2>' +
      '<p class="text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed">' + esc(d.text.slice(0, 8000)) + (d.text.length > 8000 ? '… [truncated]' : '') + '</p>', true);
  }));
  $$('[data-deldoc]', body).forEach(b => b.addEventListener('click', () => {
    if (!confirm('Delete this uploaded document?')) return;
    const st = getStore();
    st.customDocs.splice(parseInt(b.dataset.deldoc, 10), 1);
    saveStore(st); toast('Document deleted.'); renderAdminDocs(body);
  }));
  $$('[data-gendoc]', body).forEach(b => b.addEventListener('click', () => {
    const idx = parseInt(b.dataset.gendoc, 10);
    const d = getStore().customDocs[idx];
    pendingQuestions = generateQuestionsFromText(d.text, d.cat, d.title);
    renderQGenReview($('#qgen-area', body) || body, d);
    $('#qgen-area').scrollIntoView({ behavior: 'smooth' });
  }));
}

/** Extract text from a PDF in-browser using PDF.js (loaded on demand from CDN). */
function loadPdfJs() {
  if (window.pdfjsLib) return Promise.resolve();
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';
    s.onload = () => {
      window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';
      resolve();
    };
    s.onerror = () => reject(new Error('Could not load PDF reader (network needed).'));
    document.head.appendChild(s);
  });
}

async function extractPdfText(file, statusEl) {
  await loadPdfJs();
  const buf = await file.arrayBuffer();
  const pdf = await window.pdfjsLib.getDocument({ data: buf }).promise;
  let out = '';
  const maxPages = Math.min(pdf.numPages, 60);
  for (let i = 1; i <= maxPages; i++) {
    const page = await pdf.getPage(i);
    const tc = await page.getTextContent();
    out += tc.items.map(it => it.str).join(' ') + '\n';
    if (statusEl) statusEl.textContent = 'Extracting page ' + i + ' of ' + maxPages + '…';
  }
  return out;
}

const STOPWORDS = new Set(('the,a,an,and,or,of,to,in,on,for,with,by,at,from,as,is,are,was,were,be,been,being,it,its,this,that,these,those,which,who,whom,whose,what,when,where,why,how,all,any,both,each,few,more,most,other,some,such,no,nor,not,only,own,same,so,than,too,very,can,will,just,should,now,into,out,up,down,over,under,between,through,during,before,after,above,below,per,must,shall,may,also,within,without,upon,including,include,includes,et,al').split(','));

/**
 * Generate simple ORIGINAL quiz questions from document text.
 * Strategy: find sentences containing a repeated key term, blank the term,
 * and build distractors from other key terms in the same document.
 * The admin reviews/edits every question before publishing — nothing is
 * copied verbatim beyond the single blanked term.
 */
function generateQuestionsFromText(text, cat, docTitle) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [];
  const words = text.toLowerCase().match(/[a-z][a-z\-]{3,}/g) || [];
  const freq = {};
  words.forEach(w => { if (!STOPWORDS.has(w)) freq[w] = (freq[w] || 0) + 1; });
  const keyTerms = Object.keys(freq).filter(w => freq[w] >= 3).sort((a, b) => freq[b] - freq[a]).slice(0, 40);
  const out = [];
  const used = new Set();
  for (const s of sentences) {
    if (out.length >= 10) break;
    const clean = s.trim();
    if (clean.length < 40 || clean.length > 280) continue;
    const lower = clean.toLowerCase();
    const term = keyTerms.find(t => {
      const re = new RegExp('\\b' + t.replace(/[-]/g, '\\-') + '\\b');
      return re.test(lower) && !used.has(t);
    });
    if (!term) continue;
    const distract = shuffle(keyTerms.filter(t => t !== term)).slice(0, 3);
    if (distract.length < 3) continue;
    used.add(term);
    const blanked = clean.replace(new RegExp('\\b' + term.replace(/[-]/g, '\\-') + '\\b', 'i'), '_____');
    const options = shuffle([term].concat(distract));
    out.push({
      id: uid('cq'), cat: cat, sop: docTitle || 'Upload',
      q: 'Complete the statement from "' + (docTitle || 'the document') + '": ' + blanked,
      o: options, a: options.indexOf(term),
      e: 'The missing term is "' + term + '" — review the source document for full context.'
    });
  }
  return out;
}

function renderQGenReview(area, doc) {
  if (!pendingQuestions.length) {
    area.innerHTML = '<div class="bg-amber-50 dark:bg-amber-900/20 border border-amber-300 dark:border-amber-700 rounded-2xl p-5 text-sm">The generator could not find enough repeated key terms in this document to build questions. Try a longer document.</div>';
    return;
  }
  area.innerHTML =
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5"><h3 class="font-bold mb-1">Review generated questions</h3>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-4">From: <strong>' + esc(doc.title) + '</strong> — ' + pendingQuestions.length + ' draft questions. Edit or delete each one, then publish the keepers to the <strong>' + esc(CAT_LABELS[doc.cat]) + '</strong> bank.</p>' +
    '<div class="space-y-4" id="qgen-list">' +
    pendingQuestions.map((q, i) =>
      '<div class="border border-slate-200 dark:border-slate-700 rounded-xl p-3" data-qg="' + i + '">' +
      '<label class="block text-xs font-semibold text-slate-500 mb-1">Question ' + (i + 1) + '</label>' +
      '<textarea data-f="q" rows="2" class="w-full mb-2 px-2 py-1.5 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">' + esc(q.q) + '</textarea>' +
      '<div class="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">' +
      q.o.map((opt, oi) => '<label class="flex items-center gap-2 text-sm"><input type="radio" name="qg-a-' + i + '" value="' + oi + '"' + (oi === q.a ? ' checked' : '') + '> <input data-f="o' + oi + '" value="' + esc(opt) + '" class="flex-1 px-2 py-1 rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800 text-sm"></label>').join('') +
      '</div>' +
      '<label class="block text-xs font-semibold text-slate-500 mb-1">Explanation</label>' +
      '<input data-f="e" value="' + esc(q.e) + '" class="w-full mb-2 px-2 py-1 text-sm rounded-lg border border-slate-300 dark:border-slate-600 bg-white dark:bg-slate-800">' +
      '<button data-qgdel="' + i + '" class="text-xs px-3 py-1 rounded-lg border border-red-500 text-red-600 dark:text-red-400">Delete this question</button></div>').join('') +
    '</div>' +
    '<div class="flex gap-2 mt-4"><button id="qgen-publish" class="px-5 py-2.5 rounded-xl bg-green-700 text-white font-bold">Publish to question bank</button>' +
    '<button id="qgen-discard" class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700">Discard all</button></div></div>';

  $$('[data-qgdel]', area).forEach(b => b.addEventListener('click', () => {
    pendingQuestions.splice(parseInt(b.dataset.qgdel, 10), 1);
    renderQGenReview(area, doc);
  }));
  $('#qgen-discard').addEventListener('click', () => { pendingQuestions = []; area.innerHTML = ''; toast('Drafts discarded.'); });
  $('#qgen-publish').addEventListener('click', () => {
    const st = getStore();
    let n = 0;
    $$('[data-qg]', area).forEach(card => {
      const i = parseInt(card.dataset.qg, 10);
      const draft = pendingQuestions[i];
      const qtext = $('[data-f="q"]', card).value.trim();
      const opts = [0, 1, 2, 3].map(oi => $('[data-f="o' + oi + '"]', card).value.trim());
      const checked = $('input[name="qg-a-' + i + '"]:checked', card);
      const ans = checked ? parseInt(checked.value, 10) : 0;
      const exp = $('[data-f="e"]', card).value.trim();
      if (!qtext || opts.some(o => !o)) return; // skip incomplete
      st.customQuestions.push({ id: draft.id, cat: draft.cat, sop: draft.sop, q: qtext, o: opts, a: ans, e: exp || 'See the source document.' });
      n++;
    });
    saveStore(st); scheduleCloudSync();
    pendingQuestions = []; area.innerHTML = '';
    toast(n + ' question' + (n === 1 ? '' : 's') + ' published to the bank.');
  });
}

/* ------------------------------ Admin: data -------------------------------- */
function renderAdminData(body) {
  body.innerHTML =
    '<div class="grid grid-cols-1 sm:grid-cols-2 gap-4">' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5"><h3 class="font-bold mb-2">Export / Import</h3>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">Full backup of profiles, quiz results, custom questions, and uploaded documents (JSON).</p>' +
    '<div class="flex flex-wrap gap-2"><button id="data-export" class="px-4 py-2 rounded-lg bg-phfr-navy text-white text-sm font-bold">Export JSON</button>' +
    '<label class="px-4 py-2 rounded-lg border border-slate-300 dark:border-slate-700 text-sm font-semibold cursor-pointer">Import JSON<input id="data-import" type="file" accept=".json" class="hidden"></label></div></div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5"><h3 class="font-bold mb-2">Score report</h3>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">Download every quiz result as a CSV spreadsheet.</p>' +
    '<button id="data-csv" class="px-4 py-2 rounded-lg bg-green-700 text-white text-sm font-bold">Export scores CSV</button></div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 sm:col-span-2 border-2 border-red-200 dark:border-red-900"><h3 class="font-bold mb-2 text-red-700 dark:text-red-400">Danger zone</h3>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">Delete ALL app data on this device: profiles, results, uploads, custom questions, and the admin password.</p>' +
    '<button id="data-reset" class="px-4 py-2 rounded-lg bg-red-700 text-white text-sm font-bold">Reset all data</button></div></div>';

  $('#data-export').addEventListener('click', () => {
    downloadFile('phfr-hub-backup-' + new Date().toISOString().slice(0, 10) + '.json', JSON.stringify(getStore(), null, 2), 'application/json');
    toast('Backup exported.');
  });
  $('#data-import').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    if (!f) return;
    try {
      const incoming = JSON.parse(await f.text());
      const st = getStore();
      ['profiles', 'results', 'customQuestions', 'customDocs'].forEach(k => {
        const have = new Set((st[k] || []).map(x => x.id));
        (incoming[k] || []).forEach(x => { if (x && x.id && !have.has(x.id)) { st[k].push(x); have.add(x.id); } });
      });
      if (!st.admin && incoming.admin) st.admin = incoming.admin;
      saveStore(st); scheduleCloudSync(); toast('Import merged.');
    } catch (err) { toast('Import failed: not valid JSON.', 'error'); }
  });
  $('#data-csv').addEventListener('click', () => {
    const st = getStore();
    const nameOf = id => { const p = st.profiles.find(p => p.id === id); return p ? p.name : '(removed)'; };
    const rows = [['Name', 'Date', 'Category', 'SOP filter', 'Correct', 'Total', 'Score %', 'Missed count']];
    st.results.forEach(r => rows.push([nameOf(r.profileId), new Date(r.date).toISOString(), CAT_LABELS[r.category] || r.category, r.sopFilter || '', r.correct, r.total, r.score, r.missed.length]));
    downloadFile('phfr-hub-scores-' + new Date().toISOString().slice(0, 10) + '.csv', rows.map(r => r.map(csvCell).join(',')).join('\n'), 'text/csv');
    toast('CSV exported.');
  });
  $('#data-reset').addEventListener('click', () => {
    const c1 = confirm('Really delete ALL data? This cannot be undone.');
    if (!c1) return;
    const c2 = prompt('Type DELETE to confirm:');
    if (c2 !== 'DELETE') return toast('Reset cancelled.', 'error');
    localStorage.removeItem(STORE_KEY);
    adminAuthed = false; pendingQuestions = [];
    refreshHeader(); toast('All data erased.'); navTo('home');
  });
}

/* ------------------------------ Firebase sync (optional) ------------------- */
let cloud = null; // {db} when configured
let cloudTimer = null;

function initCloudSync() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf('PASTE_') === 0) return; // not configured
  const load = src => new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src;
    s.onload = res; s.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(s);
  });
  load('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
    .then(() => load('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'))
    .then(() => {
      try {
        firebase.initializeApp(cfg);
        cloud = { db: firebase.firestore() };
        console.info('[phfr-hub] Cloud sync enabled.');
        pullCloudOnce();
      } catch (e) { console.warn('[phfr-hub] Firebase init failed:', e); }
    })
    .catch(e => console.warn('[phfr-hub] Cloud sync unavailable:', e.message));
}

/** Merge cloud results/profiles into local store (additive, by id). Runs once at startup. */
async function pullCloudOnce() {
  if (!cloud) return;
  try {
    const st = getStore();
    const usersSnap = await cloud.db.collection('users').get();
    const haveP = new Set(st.profiles.map(p => p.id));
    usersSnap.forEach(doc => { const d = doc.data(); if (d && d.id && !haveP.has(d.id)) { st.profiles.push(d); haveP.add(d.id); } });
    const resSnap = await cloud.db.collection('quizResults').get();
    const haveR = new Set(st.results.map(r => r.id));
    resSnap.forEach(doc => { const d = doc.data(); if (d && d.id && !haveR.has(d.id)) { st.results.push(d); haveR.add(d.id); } });
    localStorage.setItem(STORE_KEY, JSON.stringify(st));
    if (currentView === 'admin' && adminAuthed) renderAdmin($('#view'));
    if (currentView === 'progress') renderProgress($('#view'));
  } catch (e) { console.warn('[phfr-hub] Cloud pull failed:', e.message); }
}

/** Debounced push of profiles + results to Firestore. Local-first; failures are silent. */
function scheduleCloudSync() {
  if (!cloud) return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushCloud, 1500);
}

async function pushCloud() {
  if (!cloud) return;
  try {
    const st = getStore();
    const batch = cloud.db.batch();
    st.profiles.forEach(p => batch.set(cloud.db.collection('users').doc(p.id), p, { merge: true }));
    st.results.forEach(r => batch.set(cloud.db.collection('quizResults').doc(r.id), r, { merge: true }));
    await batch.commit();
  } catch (e) { console.warn('[phfr-hub] Cloud push failed:', e.message); }
}

/* ------------------------------ Init -------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#auth-btn').addEventListener('click', openAuthModal);
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => navTo(b.dataset.view)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  refreshHeader();
  initCloudSync();
  navTo('home');
});
