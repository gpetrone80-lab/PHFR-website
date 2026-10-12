/* ============================================================================
 * Palm Harbor Fire Rescue — SOP & EMS Reference Hub
 * app.js — single-file application logic (rendered into #view)
 * Storage key: phfr_hub_v1 (localStorage). Optional Firebase web sync via
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
{id:'c01',cat:'county',sop:'600-01',q:'According to the Incident Command System SOP, how should the Incident Commander name the command post?',o:['Using the incident address street name or the city/district name','Using a random phonetic code assigned by dispatch','Using the first-arriving unit\u2019s radio designation only','Command posts are not named under this SOP'],a:0,e:'The SOP calls for the CP to be named for the city/district or the street name of the incident location.',d:3},
{id:'c02',cat:'county',sop:'600-01',q:'Two working structure fires are happening at the same time in different locations. What does the SOP require for command names?',o:['They must each have their own unique command name','They may share one command name to keep radio traffic short','The second fire does not need a command name','Dispatch assigns whichever name is shortest'],a:0,e:'Two simultaneous incidents must not share a command name — each needs a distinct name to avoid confusion.',d:3},
{id:'c03',cat:'county',sop:'600-01',q:'Where should the command post be located, and what must happen once it is set?',o:['In or at a vehicle with a good view of the fire building, with the location announced on the radio','In the basement of the fire building for protection','At the nearest fire station to keep it secure','Location does not matter as long as the IC has a radio'],a:0,e:'The CP should be at a vehicle with a good view of the fire building, and its location must be announced.',d:3},
{id:'c04',cat:'county',sop:'600-01',q:'Per the ICS SOP, arriving apparatus should generally park:',o:['On the same side of the street, toward the Bravo/Delta side','On the opposite side of the street from the fire','Directly in front of the fire building\u2019s main entrance','Wherever the driver finds an open spot'],a:0,e:'Apparatus should park on the same side of the street, toward the Bravo/Delta (rear) side.',d:3},
{id:'c05',cat:'county',sop:'600-01',q:'What tool does the SOP expect the IC to use to track units and assignments at an incident?',o:['A tactical worksheet or command board','A personal notebook kept in the IC\u2019s pocket','The dispatch CAD screen only','No tracking tool is required'],a:0,e:'The IC uses a tactical worksheet/command board and tracks unit passports to maintain accountability.',d:2},
{id:'c06',cat:'county',sop:'600-11',q:'The accountability system required by SOP 600-11 is built around:',o:['A passport system in which each unit\u2019s tags are collected at the command post','A verbal headcount shouted across the fireground','GPS trackers issued to every firefighter','Signing a roster at the fire station before the shift'],a:0,e:'The SOP mandates the passport system — unit tags are gathered at the CP so command can track assignments.',d:1},
{id:'c07',cat:'county',sop:'600-11',q:'What does "PAR" stand for in the accountability SOP?',o:['Personnel Accountability Report','Primary Attack Response','Post-Action Review','Protective Apparatus Requirement'],a:0,e:'PAR stands for Personnel Accountability Report — a roll call of all personnel on scene.',d:1},
{id:'c08',cat:'county',sop:'600-11',q:'When should a PAR be conducted during an incident?',o:['At key benchmarks such as after a mayday, an evacuation, or a change in strategy','Only at the very end of the incident','Only when the fire chief arrives on scene','PAR checks are optional'],a:0,e:'PARs are done at critical points — after maydays, evacuations, strategy changes, and similar benchmarks.',d:3},
{id:'c09',cat:'county',sop:'600-13',q:'What is the primary job of the Rapid Intervention Crew?',o:['Stand by as a dedicated crew ready to rescue firefighters who become lost, trapped, or injured','Take over the fire attack from the first-in engine','Direct traffic around the incident scene','Handle all radio communications for command'],a:0,e:'The RIC is a dedicated standby crew whose sole purpose is firefighter rescue.',d:1},
{id:'c10',cat:'county',sop:'600-13',q:'The "2-in/2-out" rule behind the RIC requirement means:',o:['At least two firefighters enter together and at least two remain outside ready to assist','Two engines must arrive before any entry is made','Crews work in pairs for exactly two minutes at a time','Two officers must approve every interior assignment'],a:0,e:'Two in, two out: interior crews work in pairs with at least two firefighters outside ready to help.',d:1},
{id:'c11',cat:'county',sop:'600-12',q:'Rehabilitation at an incident is required to provide crews with:',o:['Rest, hydration, cooling/warming, and medical monitoring','A full meal and a nap before returning to quarters','Punishment for working too slowly','Nothing — rehab is optional'],a:0,e:'Rehab provides rest, fluids, temperature control, and medical monitoring before crews go back to work.',d:1},
{id:'c12',cat:'county',sop:'600-12',q:'When should a rehab sector be established?',o:['During extended, large-scale, or physically demanding incidents','Only on training days','After the incident is completely over','Only when the temperature is below freezing'],a:0,e:'Rehab is set up for long or strenuous operations where crew fatigue becomes a safety risk.',d:2},
{id:'c13',cat:'county',sop:'600-04',q:'Per the PPE and SCBA SOP, breathing apparatus must be worn:',o:['Whenever operating in smoke or an IDLH atmosphere, and during overhaul until the air is verified clear','Only when the fire is fully involved','Only by the officer, not the crew','Only at hazardous materials incidents'],a:0,e:'SCBA is required in smoke/IDLH atmospheres and stays on through overhaul until the air is proven safe.',d:3},
{id:'c14',cat:'county',sop:'600-04',q:'Which statement best reflects the SOP\u2019s approach to protective clothing?',o:['Full structural PPE is the minimum for fireground operations','PPE is optional once the fire is knocked down','Turnout gear is only needed at night','Gloves may be skipped for better dexterity on the fireground'],a:0,e:'The SOP treats full PPE as the baseline — it is not optional on the fireground.',d:1},
{id:'c15',cat:'county',sop:'600-06',q:'A proper on-scene radio (size-up) report should include:',o:['What is burning, building and smoke conditions, exposures, actions being taken, and resources needed','Only the incident address','The names of all crew members on the apparatus','A request for the news media to respond'],a:0,e:'The size-up paints the picture: conditions, building, exposures, actions, and needs.',d:2},
{id:'c16',cat:'county',sop:'600-06',q:'Who is responsible for giving the initial on-scene radio report?',o:['The first-arriving officer or company','Dispatch, based on the 911 call','The last unit to arrive','The fire chief, after arriving'],a:0,e:'The first-arriving officer gives the initial size-up so everyone shares the same picture.',d:1},
{id:'c17',cat:'county',sop:'600-07',q:'The communications SOP emphasizes which style of radio traffic?',o:['Clear text — plain language instead of codes','Ten-codes for everything to save airtime','Whispering to keep the channel calm','Text messages instead of the radio'],a:0,e:'Clear text keeps messages understood by every agency on the channel.',d:1},
{id:'c18',cat:'county',sop:'600-03',q:'Under the Safety SOP, "freelancing" on the fireground is:',o:['Prohibited — all members operate within the incident action plan','Encouraged for experienced firefighters','Allowed when command is busy','Required during overhaul'],a:0,e:'Everyone works inside the plan; freelancing is prohibited because it endangers crews and breaks accountability.',d:1},
{id:'c19',cat:'county',sop:'600-03',q:'Who is responsible for safety at an incident?',o:['Every member on scene, in addition to command and safety officers','Only the designated safety officer','Only the incident commander','Safety is dispatch\u2019s responsibility'],a:0,e:'Safety is everyone\u2019s job — every member must recognize hazards and speak up.',d:3},
{id:'c20',cat:'county',sop:'600-20',q:'The FIRST priority for the initial company at a suspected hazmat incident is to:',o:['Isolate the area and deny entry','Rush in to identify the chemical','Begin decontamination immediately','Move the leaking container'],a:0,e:'Isolate and deny entry first — identify the product from a safe distance, then call for the hazmat team.',d:3},
{id:'c21',cat:'county',sop:'600-20',q:'How should responders identify an unknown hazardous material on initial response?',o:['From a safe distance using binoculars, shipping papers, or placards — without entering the hot zone','By smelling the substance to recognize it','By touching a small sample','By entering the spill area with SCBA to read the label up close'],a:0,e:'Identify from a safe distance; never enter the hot zone just to read a label.',d:3},
{id:'c22',cat:'county',sop:'600-19',q:'At a natural gas leak, responders should:',o:['Eliminate ignition sources, evacuate the area, and let the gas utility control the source','Immediately shut off the gas at the street with any available tool','Light off the leaking gas to burn it away safely','Use power tools to dig up the leaking line'],a:0,e:'Kill ignition sources, get people out, monitor the air, and let the utility stop the leak.',d:3},
{id:'c23',cat:'county',sop:'600-27',q:'When investigating a carbon monoxide alarm, crews should:',o:['Use a meter to check the atmosphere and evacuate occupants if CO is present','Assume it is a false alarm and reset the detector','Open windows and leave without metering','Tell occupants to call back tomorrow'],a:0,e:'Meter the space, evacuate as needed, ventilate, and find the source before re-entry.',d:2},
{id:'c24',cat:'county',sop:'600-21',q:'Ventilation must be coordinated with the fire attack because:',o:['Poorly timed ventilation can pull fire toward victims or interior crews','Ventilation is never needed','It makes the fire burn slower','Coordination is only needed at high-rise fires'],a:0,e:'Ventilation changes fire behavior — it must be timed with attack so it does not endanger occupants or crews.',d:3},
{id:'c25',cat:'county',sop:'600-18',q:'When a building has a fire department connection (FDC), arriving companies should:',o:['Supply the FDC to boost the building\u2019s sprinkler or standpipe system','Ignore it — built-in systems work on their own','Shut off the building\u2019s water supply first','Connect to it only after the fire is out'],a:0,e:'Supplying the FDC supports sprinklers and standpipes with the pressure and volume they were designed for.',d:2},
{id:'c26',cat:'county',sop:'600-17',q:'A key position in high-rise operations is:',o:['Lobby control, to manage elevators, personnel, and equipment movement','The roof DJ booth','A photographer on the top floor','A second incident commander in the basement'],a:0,e:'Lobby control manages the flow of people and equipment — critical in tall buildings.',d:2},
{id:'c27',cat:'county',sop:'600-14',q:'On an automatic alarm response, crews are expected to:',o:['Investigate thoroughly to confirm whether a real emergency exists','Assume it is false and return to service','Wait outside until the alarm company calls back','Only check the pull station nearest the door'],a:0,e:'Every alarm gets a real investigation — verify conditions before clearing the scene.',d:2},
{id:'c28',cat:'county',sop:'600-16',q:'At a suspected terrorism incident, responders must consider:',o:['The possibility of secondary devices and stage well clear of the scene','That the scene is safe once police arrive','Rushing in quickly before the media arrives','That hazmat procedures do not apply'],a:0,e:'Secondary devices are a real threat — stage clear, use unified command with law enforcement, and put safety first.',d:3},
{id:'c29',cat:'county',sop:'600-22',q:'The safest order of actions for a water rescue is:',o:['Reach or throw to the victim before entering the water yourself','Swim out immediately — speed matters most','Enter the water first, then look for flotation','Wait for the victim to swim to you'],a:0,e:'Reach, throw, row, then go — entering the water is the last resort, with proper flotation and backup.',d:3},
{id:'c30',cat:'county',sop:'600-23',q:'At a technical rescue (trench, collapse, confined space), the first rule is to:',o:['Secure the scene and avoid becoming a second victim','Jump in immediately to save time','Start digging with heavy equipment right away','Send the newest firefighter in first'],a:0,e:'Scene safety first: stabilize, call for specialized teams, and never rush into the same trap.',d:3},
{id:'c31',cat:'county',sop:'600-25',q:'When setting up a helicopter landing zone, crews should:',o:['Choose a clear, flat area, secure loose objects, and keep personnel clear of the rotor wash zone','Land the helicopter on the roadway between apparatus','Stand under the flight path to guide the pilot','Keep the landing zone as small as possible'],a:0,e:'A clear LZ with secured debris and personnel kept clear keeps the landing safe.',d:2},
{id:'c32',cat:'county',sop:'600-15',q:'A major concern when shifting from structure tactics to wildland fire is:',o:['Fire behavior driven by wind, fuel, and terrain — with escape routes always identified','That wildland fires never threaten structures','That water is never needed','That the wind always helps firefighters'],a:0,e:'Wildland fire behavior is driven by weather, fuel, and topography — always know your escape routes.',d:2},
{id:'c33',cat:'county',sop:'600-24',q:'During civil disturbances, fire operations should:',o:['Coordinate closely with law enforcement and prioritize crew safety','Operate independently without police involvement','Rush into the middle of the crowd for faster access','Leave all protective equipment at the station'],a:0,e:'Work with law enforcement, stage securely, and put crew safety ahead of property.',d:2},
{id:'c34',cat:'county',sop:'600-10',q:'Under the PIO SOP, media inquiries at an incident should be directed to:',o:['The designated public information officer or command','Any firefighter near the cameras','The newest probationary member','Dispatch, by phone only'],a:0,e:'One coordinated voice — the PIO or command — keeps incident messaging accurate.',d:1},
{id:'c35',cat:'county',sop:'600-09',q:'SOP 600-09 in the county series is currently:',o:['Blank and reserved for future use','The most frequently used SOP','About marine vessel fires','Retired and deleted'],a:0,e:'600-09 is an unassigned, reserved number in the series.',d:1},
{id:'c36',cat:'county',sop:'600-26',q:'Fires on commercial marine vessels at dock present special challenges including:',o:['Limited access, vessel stability concerns, and large water supply needs','That boats cannot burn','That no special coordination is needed','That water supply is never an issue'],a:0,e:'Vessel fires mean tight access, stability risks, and big water demands — coordinate with marine units.',d:3},
{id:'c37',cat:'county',sop:'600-08',q:'Traffic signal preemption devices are used to:',o:['Change signals in favor of responding emergency vehicles at intersections','Turn off all traffic lights in the city','Speed up the fire apparatus engine','Replace the siren'],a:0,e:'Preemption gives emergency vehicles a green light, reducing intersection risk on response.',d:1},
{id:'c38',cat:'county',sop:'600-05',q:'During adverse weather operations, command should consider:',o:['Lightning, flooding, and heat effects on both the incident and crew safety','That weather never affects fire behavior','Cancelling all responses during rain','That lightning is only dangerous at night'],a:0,e:'Storms, lightning, floodwater, and extreme heat all change tactics and threaten crews.',d:2},
{id:'c39',cat:'county',sop:'600-02',q:'The first-arriving company at a working fire is generally expected to:',o:['Assume command, give a size-up, and begin fire attack or rescue as conditions dictate','Wait for the battalion chief before doing anything','Park two blocks away and observe','Begin overhaul immediately'],a:0,e:'First in takes command, reports conditions, and acts on the most urgent priority — rescue or attack.',d:2},
{id:'c40',cat:'county',sop:'600-01',q:'Keeping "span of control" manageable under ICS means a supervisor should directly oversee:',o:['A limited number of people or units — typically around five, never a huge group','As many units as possible to save radio time','Only one person at a time','The entire incident by themselves'],a:0,e:'ICS works when each supervisor manages a small, effective number of subordinates.',d:2}
];

const QCOUNTY_EXTRA = [
{id:'c41',cat:'county',sop:'600-01',q:'When a higher-ranking officer arrives and takes over an incident, what should happen?',o:['Nothing — command automatically stays with the first officer','A face-to-face briefing followed by a radio announcement of the transfer','The new officer silently starts giving orders','Command transfers only after the fire is out'],a:1,e:'Transfer of command requires a briefing on conditions and actions, plus an announcement so everyone knows who is in charge.',d:3},
{id:'c42',cat:'county',sop:'600-01',q:'What is the purpose of ICS vests at an incident scene?',o:['To keep firefighters warm in cold weather','To carry extra radio batteries','To identify command staff by their assigned role','To replace turnout gear during overhaul'],a:2,e:'ICS vests are labeled or color-coded so everyone can spot who holds each command role.',d:1},
{id:'c43',cat:'county',sop:'600-01',q:'In the geographical designation system, the "Charlie side" of a building is the:',o:['Front or address side','Left side when facing the front','Right side when facing the front','Rear of the building'],a:3,e:'Sides run Alpha (front), Bravo (left), Charlie (rear), Delta (right) as seen facing the address side.',d:1},
{id:'c44',cat:'county',sop:'600-01',q:'What is the function of a staging area at an incident?',o:['To hold unassigned resources until command gives them an assignment','To store damaged equipment','To serve as the media briefing location','To park civilian vehicles'],a:0,e:'Staging keeps extra units organized and ready instead of freelancing or clogging the scene.',d:1},
{id:'c45',cat:'county',sop:'600-01',q:'When a firefighter calls a mayday, what should happen to radio traffic?',o:['Everyone keeps talking so command hears everything','The channel is cleared for emergency traffic related to the mayday','All units switch to a music station','Dispatch hangs up all phone lines'],a:1,e:'A mayday gets priority — the channel is cleared so rescue communications get through.',d:2},
{id:'c46',cat:'county',sop:'600-02',q:'The engine company\u2019s primary fireground function is:',o:['Raising ladders and ventilation','Forcible entry and search','Water supply and fire attack','Traffic control only'],a:2,e:'Engines bring water to the fire — supply lines and attack lines are their core job.',d:1},
{id:'c47',cat:'county',sop:'600-02',q:'Truck (ladder) companies are primarily responsible for:',o:['Ventilation, search, forcible entry, and ladder work','Pumping water to attack lines','Transporting patients to the hospital','Directing traffic at intersections'],a:0,e:'Truck work covers the support functions: ladders, ventilation, search, forcible entry, and utilities.',d:1},
{id:'c48',cat:'county',sop:'600-02',q:'When positioning apparatus at a structure fire, crews should:',o:['Block every lane so no one can drive through','Park as close to the fire building as possible','Stack all apparatus bumper to bumper','Leave room for ladder trucks and incoming units to work'],a:3,e:'Good placement leaves working space for aerial devices and later-arriving companies.',d:2},
{id:'c49',cat:'county',sop:'600-02',q:'Which county SOP covers Response, Placement, and Company Functions?',o:['600-01','600-02','600-11','600-14'],a:1,e:'SOP 600-02 addresses response, apparatus placement, and company functions.',d:1},
{id:'c50',cat:'county',sop:'600-03',q:'Under the Safety SOP, what authority does the Incident Safety Officer have?',o:['The authority to stop any operation deemed immediately dangerous','No authority — the role is advisory only','Authority only over EMS calls','Authority to issue traffic tickets'],a:0,e:'The safety officer can halt unsafe acts or operations on the spot.',d:3},
{id:'c51',cat:'county',sop:'600-03',q:'Regarding seatbelts on responding apparatus, the Safety SOP requires:',o:['Seatbelts are optional for officers','Only the driver must be belted','All occupants belted whenever the apparatus is moving','Seatbelts are only needed on the highway'],a:2,e:'Everyone rides belted — unrestrained riders become projectiles in a crash.',d:1},
{id:'c52',cat:'county',sop:'600-03',q:'The risk management approach in the Safety SOP prioritizes:',o:['Saving property above all else','Firefighter life safety first, then civilian rescue, then property','Speed over all other concerns','Saving the most expensive property first'],a:1,e:'Risk decisions put firefighter lives first — we risk a lot to save a lot, and little to save little.',d:3},
{id:'c53',cat:'county',sop:'600-03',q:'When backing fire apparatus, the Safety SOP calls for:',o:['Backing quickly to save time','No spotter if the camera works','Backing without warning anyone','A spotter guiding the driver'],a:3,e:'A spotter behind the apparatus prevents struck-by injuries and collisions.',d:1},
{id:'c54',cat:'county',sop:'600-04',q:'What is a PASS device and when should it be on?',o:['A personal alert that sounds if a firefighter stops moving — worn and armed in IDLH atmospheres','A GPS unit worn only by chiefs','A radio encryption device','A thermometer for the fire building'],a:0,e:'PASS (Personal Alert Safety System) signals a downed firefighter; it must be armed on interior operations.',d:2},
{id:'c55',cat:'county',sop:'600-04',q:'Before placing an SCBA in service, a firefighter should confirm:',o:['The cylinder is painted the right color','The straps are cut for comfort','The cylinder is fully charged and the facepiece seals properly','The low-air alarm is disabled'],a:2,e:'Checks confirm a full cylinder, working regulator and alarm, and a proper facepiece seal.',d:3},
{id:'c56',cat:'county',sop:'600-04',q:'If your SCBA low-air alarm activates while inside a structure, you should:',o:['Keep working until the air runs out','Begin exiting immediately with your partner','Remove the facepiece to conserve air','Wait for command to tell you to leave'],a:1,e:'The low-air alarm means your reserve is limited — exit now, before it becomes an emergency.',d:2},
{id:'c57',cat:'county',sop:'600-04',q:'Different helmet colors in the fire service are used to:',o:['Match the apparatus paint scheme','Show which station a firefighter is from','Indicate personal fashion preference','Identify rank or assignment at a glance'],a:3,e:'Helmet colors give instant visual identification of officers, firefighters, or specialty roles.',d:1},
{id:'c58',cat:'county',sop:'600-05',q:'When lightning threatens during outdoor operations, crews should:',o:['Suspend exposed operations and seek substantial shelter','Keep working — turnout gear blocks lightning','Stand under the tallest tree','Hold metal tools overhead to test the air'],a:0,e:'Lightning kills — stop exposed work and shelter inside a building or vehicle.',d:2},
{id:'c59',cat:'county',sop:'600-05',q:'If floodwater covers a roadway on your response route, you should:',o:['Drive through quickly before it gets deeper','Find another route — never drive through moving or unknown-depth water','Speed up to hydroplane across','Stop and wait exactly ten minutes'],a:1,e:'Floodwater can stall or sweep apparatus; unknown depth hides washed-out road. Go around.',d:2},
{id:'c60',cat:'county',sop:'600-05',q:'High winds during an incident can:',o:['Only affect radio reception','Be safely ignored','Change fire behavior and turn loose objects into hazards','Help ventilation by clearing all smoke instantly'],a:2,e:'Wind drives fire spread and launches debris — secure the scene and adjust tactics.',d:2},
{id:'c61',cat:'county',sop:'600-05',q:'Which county SOP covers Adverse Weather operations?',o:['600-03','600-06','600-24','600-05'],a:3,e:'SOP 600-05 addresses operations during adverse weather conditions.',d:1},
{id:'c62',cat:'county',sop:'600-06',q:'If the actual incident address differs from the dispatched address, the first unit should:',o:['Announce the correct address in the on-scene report','Keep quiet so dispatch is not embarrassed','Wait for dispatch to figure it out','Give the wrong address to save time'],a:0,e:'A wrong address sends everyone else to the wrong place — correct it on the air immediately.',d:2},
{id:'c63',cat:'county',sop:'600-06',q:'Announcing the "mode of operation" tells incoming units whether crews are:',o:['Wearing seatbelts','Working offensively inside or defensively from outside','Using clear text or codes','Taking a rehab break'],a:1,e:'Offensive vs. defensive mode shapes every decision incoming units make.',d:3},
{id:'c64',cat:'county',sop:'600-06',q:'Why does the on-scene report include the number of floors and type of occupancy?',o:['To fill airtime on the radio','To satisfy the news media','To help command gauge staffing, ladder, and search needs','Because dispatch requires it for the log'],a:2,e:'Building size and use drive how many crews, ladders, and searches the incident needs.',d:3},
{id:'c65',cat:'county',sop:'600-06',q:'Radio benchmarks such as "fire under control" are given to:',o:['Impress the media','Mark progress so command and dispatch share the same picture','End the incident automatically','Request relief crews immediately'],a:1,e:'Benchmarks communicate progress at key points so strategy and resources stay aligned.',d:2},
{id:'c66',cat:'county',sop:'600-07',q:'When a mayday is declared, dispatch and command should:',o:['Clear the channel and give the mayday priority handling','Continue normal traffic to stay calm','Ask the firefighter to call back later','Switch everyone to a new channel without telling them'],a:0,e:'Mayday traffic outranks everything — the channel and dispatch focus on the rescue.',d:1},
{id:'c67',cat:'county',sop:'600-07',q:'Good radio discipline includes:',o:['Long stories so everyone understands','Brief, clear transmissions with necessary information only','Talking over others to be heard first','Using as many codes as possible'],a:1,e:'Short, clear messages keep the channel usable for everyone who needs it.',d:1},
{id:'c68',cat:'county',sop:'600-07',q:'Which county SOP covers Communications and Dispatch?',o:['600-01','600-06','600-07','600-08'],a:2,e:'SOP 600-07 addresses communications and dispatch operations.',d:1},
{id:'c69',cat:'county',sop:'600-07',q:'Units should acknowledge dispatch and orders:',o:['Only when they feel like it','At the end of the shift','By text message an hour later','Promptly, so dispatch and command know the message was received'],a:3,e:'Acknowledgment closes the loop — without it, command cannot be sure the order landed.',d:1},
{id:'c70',cat:'county',sop:'600-08',q:'Traffic signal preemption equipment may be used by:',o:['Authorized emergency vehicles on emergency response','Any driver in a hurry','Delivery trucks with flashing lights','Personal vehicles following a fire truck'],a:0,e:'Preemption is for authorized emergency vehicles responding to emergencies — not convenience.',d:1},
{id:'c71',cat:'county',sop:'600-08',q:'If a preemption device malfunctions or is damaged, the SOP calls for:',o:['Ignoring it forever','Reporting it so the system can be repaired','Removing it yourself with hand tools','Using it more aggressively'],a:1,e:'A broken preemption system is a safety issue — report it for repair.',d:1},
{id:'c72',cat:'county',sop:'600-08',q:'Even when preemption gives you a green light, you must:',o:['Speed up to beat the cross traffic','Assume all other drivers see you','Still slow and clear the intersection before proceeding','Turn off your lights and siren'],a:2,e:'Preemption requests a green — it does not guarantee other drivers stop. Clear it like any intersection.',d:3},
{id:'c73',cat:'county',sop:'600-08',q:'You are responding and the preemption system fails to change the signal. You should:',o:['Run the red light at full speed','Stop and wait for the next cycle no matter what','Follow the department\u2019s normal emergency intersection procedures','Turn around and go home'],a:2,e:'Treat it as a standard emergency intersection: slow, clear each lane, then proceed with due regard.',d:3},
{id:'c74',cat:'county',sop:'600-10',q:'Typical PIO responsibilities at a major incident include:',o:['Preparing fact sheets, coordinating briefings, and releasing approved information','Fighting the fire','Driving the battalion chief','Cooking meals for the crew'],a:0,e:'The PIO manages the flow of accurate, approved information to the media and public.',d:1},
{id:'c75',cat:'county',sop:'600-10',q:'Regarding the names of injured victims, the PIO should:',o:['Announce them immediately on camera','Withhold names until families are notified and release is authorized','Post them on personal social media','Guess the spelling for the reporters'],a:1,e:'Victim identities are protected until proper notification and authorization occur.',d:3},
{id:'c76',cat:'county',sop:'600-10',q:'Firefighters posting incident photos or details on personal social media:',o:['Is always encouraged','Is required by the SOP','Should follow department policy — official releases come through the PIO or command','Has no rules at all'],a:2,e:'Unofficial posts can spread wrong or sensitive info; releases stay coordinated through the PIO.',d:2},
{id:'c77',cat:'county',sop:'600-10',q:'Which county SOP covers the Public Information Officer function?',o:['600-07','600-01','600-24','600-10'],a:3,e:'SOP 600-10 defines command and PIO responsibilities for incident information.',d:1},
{id:'c78',cat:'county',sop:'600-11',q:'Unit passports are collected and held:',o:['At the command post or designated accountability location','In each firefighter\u2019s locker','At the grocery store','In the apparatus glove box during the incident'],a:0,e:'Passports gathered at one point let command track who is on scene and where they are assigned.',d:1},
{id:'c79',cat:'county',sop:'600-11',q:'"Crew integrity" under the accountability system means:',o:['Crews can split up to cover more ground','Members stay together and enter, work, and exit as a unit','Only the officer needs accountability','Crews trade members freely during the incident'],a:1,e:'Staying together keeps every member accounted for and no one working alone.',d:2},
{id:'c80',cat:'county',sop:'600-11',q:'A firefighter becomes separated from their crew inside a structure. The crew should:',o:['Keep working and mention it later','Finish the assignment first, then look','Notify command immediately and prepare for a PAR or search','Leave the building quietly'],a:2,e:'A missing member is an emergency — tell command now so accountability and search begin.',d:3},
{id:'c81',cat:'county',sop:'600-11',q:'The accountability officer\u2019s main job at an incident is to:',o:['Fight the fire with the first crew','Track personnel and unit assignments for command','Direct traffic','Take photographs for the report'],a:1,e:'The accountability officer maintains the personnel picture so command knows exactly who is where.',d:2},
{id:'c82',cat:'county',sop:'600-12',q:'A rehab group should be located:',o:['Inside the fire building for quick return','Away from hazards, preferably upwind with room to rest','In the middle of the staging lanes','Wherever the media is set up'],a:1,e:'Rehab needs clean air, shade or shelter, and separation from the work area.',d:3},
{id:'c83',cat:'county',sop:'600-12',q:'Medical evaluation in rehab typically includes:',o:['Checking vital signs and assessing for heat stress or injury','A full physical exam and blood work','Dental checkups','Vision testing for new glasses'],a:0,e:'Vitals and a quick medical screen catch heat illness and injuries before crews go back in.',d:2},
{id:'c84',cat:'county',sop:'600-12',q:'Work/rest cycling in rehab is important because:',o:['It gives officers paperwork time','It is required only for chiefs','Fatigued crews make mistakes and suffer more injuries','Rest is a reward for fast work'],a:2,e:'Rotating crews through rest keeps performance up and injuries down on long incidents.',d:2},
{id:'c85',cat:'county',sop:'600-12',q:'A firefighter is released from rehab when:',o:['They ask nicely','Their friends are waiting','The incident ends','They are rested, rehydrated, and medically cleared to return'],a:3,e:'Release is based on recovery and medical clearance — not on how busy the scene is.',d:3},
{id:'c86',cat:'county',sop:'600-13',q:'The RIC should stage:',o:['Close enough to deploy immediately, in a safe location with tools ready','Back at the fire station','At the rehab area eating','A mile from the scene'],a:0,e:'RIC stages near the entry point, geared up and ready to move the moment they are needed.',d:2},
{id:'c87',cat:'county',sop:'600-13',q:'Equipment commonly staged with the RIC includes:',o:['A coffee maker and chairs','Search rope, thermal imager, spare SCBA cylinder, and forcible entry tools','Only a clipboard','Traffic cones and flares'],a:1,e:'RIC tools support firefighter rescue: search, air supply, thermal imaging, and forcible entry.',d:2},
{id:'c88',cat:'county',sop:'600-13',q:'A RIC is required whenever:',o:['Crews are washing the apparatus','Firefighters are operating inside an IDLH atmosphere','Only at training burns','The chief feels like it'],a:1,e:'Interior IDLH operations trigger the standby rescue requirement.',d:2},
{id:'c89',cat:'county',sop:'600-13',q:'Which county SOP covers the Rapid Intervention Crew?',o:['600-01','600-11','600-12','600-13'],a:3,e:'SOP 600-13 addresses RIC operations, duties, tools, and equipment.',d:1},
{id:'c90',cat:'county',sop:'600-14',q:'A waterflow alarm activation suggests:',o:['A sprinkler head has likely activated and water is flowing','Someone pulled a fire alarm for fun','The alarm panel needs new batteries only','There is definitely no fire'],a:0,e:'Waterflow means water is moving in the sprinkler system — investigate as a possible fire.',d:2},
{id:'c91',cat:'county',sop:'600-14',q:'After investigating an alarm, the system should be reset:',o:['By any passerby','Only after the cause is determined and it is safe to do so','Never — leave it ringing','Before investigating, to save time'],a:1,e:'Reset comes after the investigation confirms the building is safe.',d:3},
{id:'c92',cat:'county',sop:'600-14',q:'The alarm panel shows activation in Zone 3. Crews should:',o:['Check Zone 1 because it is closer','Ignore zones entirely','Investigate Zone 3 and the surrounding area','Reset the panel and leave'],a:2,e:'Go to the indicated zone, verify conditions there, and check around it.',d:2},
{id:'c93',cat:'county',sop:'600-14',q:'Even when an alarm is believed to be false, crews must:',o:['Skip the investigation','Clear the scene in under a minute','Write a ticket to the building owner on the spot','Still conduct a thorough investigation before leaving'],a:3,e:'Every alarm gets verified — assumptions about false alarms have missed real fires.',d:3},
{id:'c94',cat:'county',sop:'600-15',q:'In wildland firefighting, "direct attack" means:',o:['Applying water or retardant directly on the fire\u2019s edge','Attacking the fire from a mile away','Ignoring the fire and protecting only structures','Waiting for rain'],a:0,e:'Direct attack works the burning edge itself; it requires close access and manageable intensity.',d:1},
{id:'c95',cat:'county',sop:'600-15',q:'The wildland safety reminder "LCES" stands for:',o:['Ladders, Chainsaws, Engines, Stokes baskets','Lookouts, Communications, Escape routes, Safety zones','Long sleeves, Cool water, Energy bars, Sunscreen','Lights, Camera, Engine, Siren'],a:1,e:'LCES — lookouts, comms, escape routes, safety zones — is the wildland firefighter safety checklist.',d:1},
{id:'c96',cat:'county',sop:'600-15',q:'At the urban interface (where homes meet wildland), a priority is:',o:['Letting all structures burn to save the forest','Triaging structures and protecting the most savable','Parking apparatus in the brush','Using only hand tools'],a:1,e:'Interface tactics triage structures, defend what can be saved, and keep crews out of indefensible spots.',d:3},
{id:'c97',cat:'county',sop:'600-15',q:'Which county SOP covers Wildland Fire Management?',o:['600-14','600-23','600-05','600-15'],a:3,e:'SOP 600-15 addresses wildland resources, tactics, and firefighter safety.',d:1},
{id:'c98',cat:'county',sop:'600-16',q:'At a suspected terrorism incident, fire and EMS should:',o:['Establish unified command with law enforcement','Take full command and exclude police','Let the media direct operations','Skip staging to save time'],a:0,e:'Unified command joins fire, EMS, and law enforcement under one coordinated plan.',d:2},
{id:'c99',cat:'county',sop:'600-16',q:'Responders at a possible crime or terrorism scene should:',o:['Move everything to clean up quickly','Avoid disturbing potential evidence where possible','Collect souvenirs','Hose down the entire scene immediately'],a:1,e:'Preserving evidence helps the investigation — disturb as little as possible while doing the job.',d:2},
{id:'c100',cat:'county',sop:'600-16',q:'Isolation perimeters at terrorism incidents are typically:',o:['Smaller than normal to keep traffic moving','The same as a routine medical call','Larger than usual, accounting for secondary devices and unknown hazards','Unnecessary once police arrive'],a:2,e:'Bigger perimeters protect against secondary devices, contamination, and evolving threats.',d:2},
{id:'c101',cat:'county',sop:'600-16',q:'If contamination is suspected at a terrorism incident, responders should consider:',o:['Eating lunch at the scene','Decontamination needs for victims, responders, and equipment','That decon is never needed','Removing PPE immediately in the hot zone'],a:1,e:'Chemical, biological, or radiological threats make gross decon part of the plan.',d:2},
{id:'c102',cat:'county',sop:'600-17',q:'In high-rise operations, the staging floor is typically:',o:['Two floors below the fire floor','The roof','The lobby','The floor above the fire'],a:0,e:'Staging two floors below keeps resources close but out of the smoke and heat.',d:3},
{id:'c103',cat:'county',sop:'600-17',q:'Passenger elevators at a high-rise fire are dangerous because they:',o:['Are too slow','May open onto the fire floor or lose power, trapping occupants','Are always locked','Play annoying music'],a:1,e:'Elevators can deliver you to the fire or die between floors — use the stairs.',d:2},
{id:'c104',cat:'county',sop:'600-17',q:'"High-rise packs" carried to upper floors contain:',o:['Lunch for the crew','Hose, nozzles, and adapters for standpipe operations','Fireworks','Office supplies'],a:1,e:'High-rise packs bundle the hose and fittings needed to work off the standpipe system.',d:2},
{id:'c105',cat:'county',sop:'600-17',q:'Water supply for high-rise firefighting relies heavily on:',o:['Garden hoses','The building\u2019s standpipe system, supported through the FDC','Rainwater','Swimming pools only'],a:1,e:'Standpipes carry water up the building; engines boost them through the fire department connection.',d:2},
{id:'c106',cat:'county',sop:'600-18',q:'A flowing sprinkler head should generally NOT be shut down until:',o:['The fire is out and overhaul confirms no extension','The first engine arrives','The water bill arrives','Someone gets wet'],a:0,e:'Early shutdown risks rekindle — keep sprinklers operating until the fire is fully out.',d:3},
{id:'c107',cat:'county',sop:'600-18',q:'When connecting to a standpipe outlet at a fire, crews typically connect:',o:['On the fire floor itself','On the floor below the fire, then advance up','On the roof','In the basement only'],a:1,e:'Connecting below keeps the stairwell clear and the connection out of the heat.',d:3},
{id:'c108',cat:'county',sop:'600-18',q:'An important fact about automatic sprinklers is that:',o:['All heads in the building activate together','Only the head(s) heated by the fire activate','They are triggered by smoke anywhere in the building','They must be turned on manually'],a:1,e:'Sprinklers are heat-activated individually — usually one or two heads control the fire.',d:3},
{id:'c109',cat:'county',sop:'600-18',q:'Which county SOP covers Sprinkler, Standpipe, and Fire Pump Operations?',o:['600-17','600-19','600-21','600-18'],a:3,e:'SOP 600-18 addresses sprinkler, standpipe, and fire pump operations.',d:1},
{id:'c110',cat:'county',sop:'600-19',q:'Inside a structure with a suspected gas leak, responders must NOT:',o:['Operate light switches, phones, or anything that could spark','Evacuate occupants','Meter the atmosphere','Call the gas utility'],a:0,e:'Any spark can ignite accumulated gas — no switches, no phones, no equipment until ventilated and cleared.',d:2},
{id:'c111',cat:'county',sop:'600-19',q:'Crews investigating a gas leak use meters to:',o:['Check sports scores','Detect combustible gas levels and find the source','Measure water pressure','Time their response'],a:1,e:'Gas detectors quantify the hazard and help pinpoint the leak.',d:1},
{id:'c112',cat:'county',sop:'600-19',q:'For an outside natural gas leak, a priority is to:',o:['Dig up the line with a shovel','Establish a hot zone and keep the public and ignition sources clear','Light a flare to mark the spot','Let traffic drive through normally'],a:1,e:'Control the area, eliminate ignition, and let the utility stop the source.',d:2},
{id:'c113',cat:'county',sop:'600-19',q:'Shutting off gas service at the meter or street should be done by:',o:['Any bystander with a wrench','The first firefighter on scene, always','The gas utility or qualified personnel','The newest probationary member'],a:2,e:'Gas shutoffs belong to the utility or trained personnel — improper shutoffs create new hazards.',d:3},
{id:'c114',cat:'county',sop:'600-20',q:'In hazmat incident control zones, the "warm zone" is where:',o:['Decontamination takes place','The product is hottest','Spectators gather','Command eats lunch'],a:0,e:'Hot is exclusion, warm is the decon corridor, cold is support — decon happens in the warm zone.',d:2},
{id:'c115',cat:'county',sop:'600-20',q:'The Emergency Response Guidebook (ERG) helps initial responders:',o:['Identify products and determine initial isolation and protective distances','Cook meals at the station','File expense reports','Predict the weather'],a:0,e:'The ERG turns placard numbers into immediate action guidance from a safe distance.',d:1},
{id:'c116',cat:'county',sop:'600-20',q:'For first responders without hazmat technician training, the expected mode at a hazmat incident is:',o:['Offensive entry to plug the leak','Defensive — isolate, identify, and call for the hazmat team','Ignoring the incident','Diving into the product to identify it'],a:1,e:'Operations-level responders work defensively: isolate, deny entry, identify from afar, and summon technicians.',d:2},
{id:'c117',cat:'county',sop:'600-20',q:'Which county SOP covers Hazardous Materials Initial Response?',o:['600-16','600-19','600-21','600-20'],a:3,e:'SOP 600-20 addresses initial hazmat response for first responders.',d:1},
{id:'c118',cat:'county',sop:'600-21',q:'Horizontal ventilation involves:',o:['Opening windows and doors on the fire floor to let heat and smoke out laterally','Cutting the roof','Using only fans in the basement','Sealing the building airtight'],a:0,e:'Horizontal ventilation uses existing openings on the same level to channel smoke out.',d:2},
{id:'c119',cat:'county',sop:'600-21',q:'Vertical ventilation is performed by:',o:['Opening a hole in the roof over the fire area','Opening the front door','Breaking basement windows','Turning on the air conditioning'],a:0,e:'A roof opening over the fire lets heat and gases rise out, improving interior conditions.',d:1},
{id:'c120',cat:'county',sop:'600-21',q:'Positive pressure ventilation (PPV) works by:',o:['Sucking smoke out with a vacuum','Pressurizing the structure with a fan to push smoke out an exhaust opening','Sealing all openings','Waiting for wind'],a:1,e:'A PPV fan at the entry pressurizes the building, driving smoke out a designated exhaust.',d:2},
{id:'c121',cat:'county',sop:'600-21',q:'Ventilation should be delayed or avoided when crews see signs of potential backdraft, such as:',o:['Light smoke drifting away','Pressurized smoke puffing from cracks and smoke-stained windows','A small, visible flame','Cool exterior walls'],a:1,e:'Pressurized, stained smoke signals a ventilation-limited fire that could erupt when air is introduced.',d:3},
{id:'c122',cat:'county',sop:'600-22',q:'Personnel working near or over water should wear:',o:['A personal flotation device (PFD)','A weighted belt','Cotton coveralls','Nothing special'],a:0,e:'A PFD keeps rescuers afloat if they end up in the water unexpectedly.',d:1},
{id:'c123',cat:'county',sop:'600-22',q:'A throw bag is used in water rescue to:',o:['Weigh down the victim','Deliver a rope to the victim from shore','Carry lunch to the boat','Anchor the apparatus'],a:1,e:'Throwing a rope bag extends your reach without entering the water.',d:1},
{id:'c124',cat:'county',sop:'600-22',q:'A rescuer should enter the water for a rescue only:',o:['When they feel confident swimming','As the very first option','With proper flotation, backup, and tethering in place','Alone, to avoid confusion'],a:2,e:'"Go" is the last resort — protected, backed up, and tethered, never solo.',d:3},
{id:'c125',cat:'county',sop:'600-22',q:'Which county SOP covers Water Rescue?',o:['600-21','600-23','600-26','600-22'],a:3,e:'SOP 600-22 addresses water rescue dispatch, response, operations, and safety.',d:1},
{id:'c126',cat:'county',sop:'600-23',q:'In a confined space rescue, a leading atmospheric hazard is:',o:['Oxygen deficiency or toxic gases','Too much fresh air','Loud music','Bright lighting'],a:0,e:'Confined spaces can hide oxygen-poor or toxic atmospheres — monitor before and during entry.',d:1},
{id:'c127',cat:'county',sop:'600-23',q:'At a trench collapse, a major danger to rescuers is:',o:['Getting dirty','Secondary collapse of the trench walls','Paperwork','Sunburn'],a:1,e:'Trenches kill rescuers in secondary collapses — shore it and keep heavy loads back from the edge.',d:3},
{id:'c128',cat:'county',sop:'600-23',q:'When a technical rescue is beyond the first unit\u2019s capability, the priority is to:',o:['Attempt it anyway to save time','Secure the scene and request the technical rescue team early','Go home','Wait for the news cameras'],a:1,e:'An early special-team request plus scene control beats a delayed call after a failed attempt.',d:2},
{id:'c129',cat:'county',sop:'600-23',q:'Which county SOP covers Technical Rescue Response?',o:['600-20','600-22','600-15','600-23'],a:3,e:'SOP 600-23 addresses technical rescue response.',d:1},
{id:'c130',cat:'county',sop:'600-24',q:'During civil disturbances, fire units should generally:',o:['Stage in a secure location until law enforcement clears entry','Drive straight into the crowd','Park in the middle of the disturbance','Respond without telling dispatch'],a:0,e:'Secure staging keeps crews safe until police make entry workable.',d:2},
{id:'c131',cat:'county',sop:'600-24',q:'Apparatus positioning during a civil disturbance should:',o:['Block all escape routes','Keep an escape route open in case conditions worsen','Face into the crowd','Shut off and lock with crews inside the crowd'],a:1,e:'Always leave yourself a way out — conditions can change fast.',d:2},
{id:'c132',cat:'county',sop:'600-24',q:'If conditions become too dangerous during a disturbance response, crews should:',o:['Push forward regardless','Withdraw to safety and reassess with law enforcement','Abandon the apparatus unlocked','Hide in a nearby building alone'],a:1,e:'No property is worth a firefighter\u2019s life — pull back and regroup with police.',d:2},
{id:'c133',cat:'county',sop:'600-24',q:'Which county SOP covers Civil Disturbances?',o:['600-16','600-23','600-25','600-24'],a:3,e:'SOP 600-24 addresses fire operations during civil disturbances.',d:1},
{id:'c134',cat:'county',sop:'600-25',q:'Ground personnel should approach a helicopter:',o:['From the front or side, in the pilot\u2019s view, after being signaled','From the rear at a run','Under the tail rotor for shade','While it is taking off'],a:0,e:'Approach only when signaled, staying where the pilot can see you and clear of the tail rotor.',d:3},
{id:'c135',cat:'county',sop:'600-25',q:'For a night helicopter landing zone, crews should:',o:['Keep the LZ completely dark','Provide lighting that marks the LZ without blinding the pilot','Shine flashlights at the cockpit','Use fireworks to mark the corners'],a:1,e:'Light the LZ perimeter so the pilot can see it, but never aim lights at the aircraft.',d:3},
{id:'c136',cat:'county',sop:'600-25',q:'Before liftoff, ground crews must confirm:',o:['That everyone is loaded and all personnel and loose gear are clear','That the radio is off','That the pilot is in a hurry','Nothing — just wave'],a:0,e:'Liftoff needs a clear zone and confirmation — rotor wash turns loose gear into projectiles.',d:2},
{id:'c137',cat:'county',sop:'600-25',q:'Which county SOP covers Helicopter Operations?',o:['600-22','600-26','600-15','600-25'],a:3,e:'SOP 600-25 addresses landing zone responsibilities, operations, and safety.',d:1},
{id:'c138',cat:'county',sop:'600-26',q:'Marine vessel fires often demand large water volumes, so companies should:',o:['Plan for relay, tanker, or large-diameter supply operations','Use only a single garden hose','Avoid using water entirely','Wait for rain'],a:0,e:'Big vessels need big water — plan supply early with relays or marine units.',d:2},
{id:'c139',cat:'county',sop:'600-26',q:'Applying large amounts of water to a vessel can affect:',o:['Nothing at all','The vessel\u2019s stability, risking listing or capsizing','Only the paint job','The price of fish'],a:1,e:'Added water weight and free-surface effect change stability — monitor list with the crew.',d:3},
{id:'c140',cat:'county',sop:'600-26',q:'At a commercial vessel fire, command should coordinate with:',o:['No one — handle it alone','The vessel\u2019s crew, marine units, and the Coast Guard as needed','The nearest restaurant','Airline pilots'],a:1,e:'The ship\u2019s crew know the vessel; marine units and the Coast Guard bring specialized capability.',d:2},
{id:'c141',cat:'county',sop:'600-26',q:'Interior access on a vessel fire is complicated by:',o:['Wide hallways','Narrow passageways, hatches, and limited egress','Too many exits','Air conditioning'],a:1,e:'Ships are mazes of tight spaces with few ways out — plan access and escape accordingly.',d:2},
{id:'c142',cat:'county',sop:'600-27',q:'Common symptoms of carbon monoxide poisoning include:',o:['Headache, dizziness, nausea, and confusion','Hunger and thirst only','Improved vision','Extra energy'],a:0,e:'CO\u2019s flu-like symptoms — headache, dizziness, nausea, confusion — are easy to miss. Treat them seriously.',d:1},
{id:'c143',cat:'county',sop:'600-27',q:'Common household sources of carbon monoxide include:',o:['Electric LED lights','Fuel-burning appliances like furnaces, water heaters, and generators','Houseplants','Ceiling fans'],a:1,e:'Anything burning fuel can make CO — especially generators run indoors or near windows.',d:1},
{id:'c144',cat:'county',sop:'600-27',q:'After a CO alarm investigation, occupants may re-enter:',o:['Whenever they feel like it','Only after metering shows safe levels and the source is addressed','After opening one window for a minute','The next day, no matter what'],a:1,e:'Re-entry waits for clean meter readings and a found, fixed source.',d:3},
{id:'c145',cat:'county',sop:'600-27',q:'Which county SOP covers Carbon Monoxide Alarm Response?',o:['600-19','600-20','600-26','600-27'],a:3,e:'SOP 600-27 addresses CO alarm investigation.',d:1},
{id:'c146',cat:'county',sop:'600-01',q:'The Incident Safety Officer\u2019s role during an incident is to:',o:['Continuously monitor for hazards and advise command on safety issues','Take command of the fire attack','Handle payroll','Direct the media'],a:0,e:'The safety officer watches the big safety picture and speaks up before hazards hurt someone.',d:2},
{id:'c147',cat:'county',sop:'600-07',q:'"Emergency traffic" on the fireground radio is used to:',o:['Order lunch','Give priority to urgent safety messages like maydays or evacuations','Chat between friends','Report routine status'],a:1,e:'Emergency traffic preempts routine messages for maydays, evacuations, and imminent hazards.',d:2},
{id:'c148',cat:'county',sop:'600-11',q:'Which county SOP covers the Accountability System?',o:['600-01','600-13','600-11','600-12'],a:2,e:'SOP 600-11 addresses the accountability system.',d:1},
{id:'c149',cat:'county',sop:'600-21',q:'Which county SOP covers Ventilation Practices?',o:['600-18','600-17','600-04','600-21'],a:3,e:'SOP 600-21 addresses ventilation practices.',d:1},
{id:'c150',cat:'county',sop:'600-12',q:'Which county SOP covers Rehabilitation?',o:['600-12','600-03','600-13','600-04'],a:0,e:'SOP 600-12 addresses rehabilitation operations.',d:1},
];

const QCOUNTY_EXTRA2 = [
{id:'c151',cat:'county',sop:'600-01',q:'Under ICS, the Operations Section is responsible for:',o:['Cooking meals','Tactical operations that carry out the action plan','Payroll','Media interviews'],a:1,e:'Operations carries out the tactical work of the incident action plan.',d:1},
{id:'c152',cat:'county',sop:'600-02',q:'The second-arriving engine at a working fire is often assigned to:',o:['Establish water supply or back up the first attack line','Take command from the first officer','Return to quarters','Direct traffic only'],a:0,e:'The second engine secures water or backs up the initial attack line.',d:1},
{id:'c153',cat:'county',sop:'600-03',q:'Riding on tailboards or running boards of moving apparatus is:',o:['Allowed for short distances','Up to the driver','Required during parades','Prohibited'],a:3,e:'Riding outside the cab is prohibited \u2014 a fall or sudden stop can be deadly.',d:1},
{id:'c154',cat:'county',sop:'600-04',q:'SCBA "buddy checks" before entry confirm:',o:['Cylinder color matches','Each partner\u2019s SCBA is turned on and working','Everyone has the same brand','Regulators stay disconnected'],a:1,e:'Partners verify each other\u2019s air is on and the rig works before entry.',d:1},
{id:'c155',cat:'county',sop:'600-05',q:'In extreme heat, command should plan for:',o:['Heavier PPE','Faster attacks only','Skipping accountability','More frequent rehab rotations and hydration'],a:3,e:'Heat demands shorter work cycles, shade, fluids, and medical watch.',d:1},
{id:'c156',cat:'county',sop:'600-06',q:'A "nothing showing" on-scene report tells incoming units:',o:['No fire or emergency is visible from the street','The incident is over','To return to quarters','The address was wrong'],a:0,e:'"Nothing showing" tells incoming units there is no visible emergency yet.',d:1},
{id:'c157',cat:'county',sop:'600-07',q:'Standard radio designations like "Engine 41" exist to:',o:['Confuse the media','Save battery power','Identify each unit clearly on the radio','Replace unit numbers'],a:2,e:'Standard designations keep radio traffic clear about who is who.',d:1},
{id:'c158',cat:'county',sop:'600-08',q:'Preemption emitters on apparatus should be:',o:['Checked during routine apparatus inspections','Removed after each call','Used on non-emergency trips','Hidden from the driver'],a:0,e:'Emitters are life-safety equipment \u2014 inspect them like everything else.',d:1},
{id:'c159',cat:'county',sop:'600-10',q:'A Joint Information Center (JIC) is used when:',o:['The fire is out','Only one reporter shows up','Multiple agencies need one coordinated public message','Command wants no media'],a:2,e:'A JIC gives the public one consistent message from all agencies.',d:1},
{id:'c160',cat:'county',sop:'600-11',q:'Passport tags must be updated when:',o:['A member\u2019s assignment changes','The shift ends','Once a year','Never \u2014 tags are permanent'],a:0,e:'Changed assignments mean changed tags, or accountability breaks down.',d:1},
{id:'c161',cat:'county',sop:'600-12',q:'Rehab entries are documented to:',o:['Punish slow crews','Track who was rehabbed and their condition','Fill time','Impress the chief'],a:1,e:'Documenting rehab tracks who was monitored and their condition.',d:1},
{id:'c162',cat:'county',sop:'600-13',q:'While standing by as the RIC, the crew should NOT:',o:['Monitor the fireground radio','Stay geared up and staged near the entry','Take on fire attack or other tasks','Keep tools ready'],a:2,e:'A RIC committed to other tasks is not ready when a mayday comes.',d:1},
{id:'c163',cat:'county',sop:'600-14',q:'An alarm panel showing "trouble" rather than "alarm" usually means:',o:['A confirmed fire','A system fault or supervisory issue','The panel is off','Evacuation is required'],a:1,e:'"Trouble" signals a system problem; "alarm" signals activation.',d:1},
{id:'c164',cat:'county',sop:'600-15',q:'"Mop-up" in wildland firefighting means:',o:['Mopping the station floor','Extinguishing remaining hot spots after the main fire is controlled','Ignoring the fire edge','Waiting for rain'],a:1,e:'Mop-up puts out the smoldering leftovers so the fire stays out.',d:1},
{id:'c165',cat:'county',sop:'600-16',q:'A suspicious package at an incident should be:',o:['Opened to check the contents','Kicked aside','Left alone \u2014 call law enforcement / the bomb squad','Brought to the command post'],a:2,e:'Only law enforcement and the bomb squad handle suspicious packages.',d:1},
{id:'c166',cat:'county',sop:'600-17',q:'In a high-rise fire, the fire floor and the floor above get evacuation priority because:',o:['Elevators are fast','The lobby is crowded','Fire and smoke threaten those floors first','Insurance requires it'],a:2,e:'Fire and smoke rise \u2014 the fire floor and the one above are most at risk.',d:1},
{id:'c167',cat:'county',sop:'600-18',q:'The outside stem-and-yoke (OS&Y) valve on a sprinkler system shows:',o:['The water temperature','Whether the supply valve is open or closed','The alarm code','The building address'],a:1,e:'The OS&Y shows at a glance whether the sprinkler water supply is open.',d:1},
{id:'c168',cat:'county',sop:'600-19',q:'Carbon monoxide is especially dangerous because it is:',o:['Brightly colored','Colorless and odorless','Loud','Visible as thick smoke'],a:1,e:'You cannot see or smell CO, which is why detectors and meters matter.',d:1},
{id:'c169',cat:'county',sop:'600-20',q:'The "hot zone" at a hazmat incident is:',o:['The area of actual contamination \u2014 entry only for trained personnel','Where the media stands','The parking area','Where rehab is set up'],a:0,e:'The hot zone holds the actual hazard \u2014 only trained, equipped entries.',d:1},
{id:'c170',cat:'county',sop:'600-21',q:'"Natural ventilation" means:',o:['Using only fans','Sealing the building','Using existing openings like windows and doors','Cutting the roof with saws'],a:2,e:'Natural ventilation works with existing openings; no tools required.',d:1},
{id:'c171',cat:'county',sop:'600-01',q:'If the IC can no longer see the fire building from the command post, the guidance is to:',o:['Stay put no matter what','Abandon command','Move the CP to regain observation and communications','Have dispatch watch the fire'],a:2,e:'Without a view of the fire building, the CP cannot direct the incident.',d:2},
{id:'c172',cat:'county',sop:'600-02',q:'When fire threatens an exposed building, crews should:',o:['Protect exposures while attacking the main fire','Let the exposure burn','Only protect exposures','Wait for more alarms'],a:0,e:'Saving exposures while hitting the main fire limits total loss.',d:2},
{id:'c173',cat:'county',sop:'600-03',q:'A collapse zone around a fire building is generally established at:',o:['The front door only','1.5 times the building\u2019s height from the walls','Inside the building','At the hydrant'],a:1,e:'A collapsing wall can fall outward about 1.5 times the building\u2019s height.',d:2},
{id:'c174',cat:'county',sop:'600-04',q:'If your SCBA regulator malfunctions inside a structure, you should:',o:['Remove the facepiece','Keep working normally','Activate the bypass/purge and exit with your partner','Wait for the RIC to find you'],a:2,e:'The bypass gives emergency air \u2014 use it to get out with your partner.',d:2},
{id:'c175',cat:'county',sop:'600-05',q:'After a storm, wires are down across an occupied car. You should:',o:['Pull the wires clear with a pike pole','Have occupants run immediately','Drive over the wires','Tell occupants to stay inside and keep everyone clear'],a:3,e:'Energized wires can kill on contact; keep everyone clear until the utility arrives.',d:2},
{id:'c176',cat:'county',sop:'600-06',q:'A progress report to command (conditions, actions, needs) is given:',o:['When conditions change or benchmarks are reached','Only at shift change','After the incident is over','By dispatch'],a:0,e:'CAN reports keep command\u2019s picture current as conditions evolve.',d:2},
{id:'c177',cat:'county',sop:'600-07',q:'After clearing a call and being ready for another, the unit reports:',o:['Still on scene','Off the air permanently','In service and available','Back at the station only'],a:2,e:'"In service" tells dispatch the unit is ready for the next call.',d:2},
{id:'c178',cat:'county',sop:'600-10',q:'If media approach a firefighter and the PIO is unavailable, the firefighter should:',o:['Give a personal opinion on camera','Say "no comment" and refer them to the PIO or command','Make up details to be helpful','Refuse to ever speak to media'],a:1,e:'Only the PIO or command speaks for the department on incidents.',d:2},
{id:'c179',cat:'county',sop:'600-11',q:'During a PAR, each unit or division should:',o:['Stay silent to keep the channel clear','Report their status and that all personnel are accounted for','Leave the scene','Call dispatch individually'],a:1,e:'Each supervisor confirms their people are accounted for.',d:2},
{id:'c180',cat:'county',sop:'600-12',q:'Rehab should continue through overhaul because:',o:['Overhaul is easy work','Crews enjoy the break','Overhaul is strenuous with uncertain air \u2014 crews still need monitoring','The chief orders it'],a:2,e:'Overhaul still exposes crews to heat, exertion, and bad air.',d:2},
{id:'c181',cat:'county',sop:'600-13',q:'The RIC leader\u2019s key job while staged is to:',o:['Cook meals','Monitor fireground radio and conditions for firefighter distress','Direct traffic','Complete paperwork'],a:1,e:'The RIC leader watches for the first sign a firefighter needs rescue.',d:2},
{id:'c182',cat:'county',sop:'600-14',q:'When no emergency is found on an alarm call, before leaving crews should:',o:['Break the alarm panel','Leave doors unlocked','Take the panel offline permanently','Reset the system if appropriate and notify the key holder or alarm company'],a:3,e:'Leave the system ready and make sure a responsible party knows.',d:2},
{id:'c183',cat:'county',sop:'600-15',q:'"Indirect attack" in wildland firefighting means:',o:['Pouring water directly on the flames','Using only aircraft','Building fireline at a distance from the fire\u2019s edge','Ignoring the fire'],a:2,e:'Indirect attack builds line where the fire is going, not where it is.',d:2},
{id:'c184',cat:'county',sop:'600-16',q:'Fire/EMS staging at a suspected terrorism incident should be:',o:['Well clear of the scene and out of line of sight if possible','Right next to the scene','Downwind in the smoke','Inside the hot zone'],a:0,e:'Distance and concealment protect staged crews from a second attack.',d:2},
{id:'c185',cat:'county',sop:'600-17',q:'High-rise fire attack is typically launched from:',o:['The fire floor directly','The elevator lobby','The roof downward','The stairwell on the floor below, advancing up'],a:3,e:'Stairs below the fire keep crews out of the heat until the attack starts.',d:2},
{id:'c186',cat:'county',sop:'600-18',q:'Where a building has separate sprinkler and standpipe FDCs, crews must:',o:['Use either one interchangeably','Connect to the correct FDC for the system they need','Never use them','Use only the sprinkler FDC'],a:1,e:'Each FDC feeds its own system \u2014 the wrong connection wastes time.',d:2},
{id:'c187',cat:'county',sop:'600-19',q:'For a large outside gas leak, evacuation should prioritize:',o:['Upwind areas first','Downwind areas in the path of the gas','Only the leak site itself','No evacuation is needed'],a:1,e:'Gas travels downwind; clear its path first.',d:2},
{id:'c188',cat:'county',sop:'600-20',q:'Apparatus staging at a hazmat incident should be:',o:['Downhill and downwind','Uphill, upwind, and upstream of the scene','Inside the hot zone','Wherever is closest'],a:1,e:'Up-hill and up-wind keeps apparatus out of the product and vapors.',d:2},
{id:'c189',cat:'county',sop:'600-21',q:'Ventilating a basement fire is especially dangerous because:',o:['Basements never burn','It is always easy','Water cannot reach basements','Heat and smoke can trap crews with no vertical escape path'],a:3,e:'With no vertical path, heat and smoke bank down and can trap crews.',d:2},
{id:'c190',cat:'county',sop:'600-22',q:'Before throwing a rope to a distressed swimmer, rescuers should first:',o:['Jump in to help','Throw rocks to get attention','Try verbal contact and coach the victim','Leave the scene'],a:2,e:'A calm, coached victim is easier to rescue than a panicked one.',d:2},
{id:'c191',cat:'county',sop:'600-23',q:'Before beginning a machinery rescue, crews must ensure:',o:['Energy sources are locked out and tagged','The machine keeps running','Bystanders operate the controls','The machine is oiled'],a:0,e:'Lockout/tagout keeps the machine from moving during the rescue.',d:2},
{id:'c192',cat:'county',sop:'600-24',q:'When operating near a disturbance, apparatus should:',o:['Use full lights and sirens at all times','Park in the middle of the crowd','Minimize lights and sirens to avoid drawing attention','Leave engines running unattended'],a:2,e:'Lights and sirens can pull a crowd toward the apparatus.',d:2},
{id:'c193',cat:'county',sop:'600-25',q:'At a helicopter landing zone, direction on aircraft operations comes from:',o:['The newest firefighter','The media helicopter','Dispatch by phone','The pilot, who is in command of the aircraft'],a:3,e:'Only the pilot commands the aircraft \u2014 ground crews follow their direction.',d:2},
{id:'c194',cat:'county',sop:'600-26',q:'For a vessel with a fixed fire suppression system, command should:',o:['Ignore the system','Determine whether it activated or can be activated','Shut it off immediately','Use it for drinking water'],a:1,e:'A working fixed system may already be controlling the fire.',d:2},
{id:'c195',cat:'county',sop:'600-27',q:'When several occupants show CO poisoning symptoms, command should:',o:['Send everyone back inside','Treat it as an expanded incident with more resources and wider evacuation','Handle it as one routine alarm','Wait for the utility company only'],a:1,e:'Multiple symptomatic patients means a bigger exposure and response.',d:2},
{id:'c196',cat:'county',sop:'600-01',q:'When choosing a command post location, the IC should avoid spots where:',o:['It has a clear view of the fire building','It is set up in a command vehicle','A barrier like a major roadway or creek separates it from operating crews','It is on the same side as the apparatus'],a:2,e:'A barrier between the CP and crews breaks face-to-face coordination.',d:3},
{id:'c197',cat:'county',sop:'600-06',q:'A size-up report (600-06) differs from routine radio traffic (600-07) because it:',o:['Uses ten-codes','Is the initial structured picture of the incident for all incoming units','Is given by dispatch','Is optional'],a:1,e:'The size-up is the structured first picture; routine traffic is everything after.',d:3},
{id:'c198',cat:'county',sop:'600-11',q:'Accountability (600-11) and the RIC (600-13) differ in that:',o:['They are the same function','The RIC rescues firefighters while accountability tracks where everyone is','The RIC handles EMS calls','Accountability replaces the RIC'],a:1,e:'Accountability tracks people; the RIC is the dedicated rescue team.',d:3},
{id:'c199',cat:'county',sop:'600-04',q:'When planning SCBA air management for an entry team, the limiting factor is:',o:['The lowest cylinder pressure among team members','The highest pressure on the team','The officer\u2019s air only','The time of day'],a:0,e:'The team can only stay as long as its lowest cylinder allows.',d:3},
{id:'c200',cat:'county',sop:'600-18',q:'If sprinklers are controlling a fire when you arrive, you should:',o:['Shut them down immediately','Let them operate while you complete extinguishment and overhaul','Ignore the fire','Open additional heads'],a:1,e:'Shutting sprinklers early risks rekindle \u2014 let them work through overhaul.',d:3},
{id:'c201',cat:'county',sop:'600-21',q:'A trench cut in a roof is used to:',o:['Decorate the roofline','Stop horizontal fire spread through a cockloft or attic','Ventilate the basement','Replace positive pressure ventilation'],a:1,e:'A trench cut removes fuel ahead of fire racing through a cockloft.',d:3},
{id:'c202',cat:'county',sop:'600-19',q:'Natural gas is odorized for leak detection, but the odor can fade when:',o:['It is daytime','It rains','Gas passes through soil, so underground leaks may have little smell','Never \u2014 the odor is always strong'],a:2,e:'Soil can strip the odorant, making underground leaks nearly odorless.',d:3},
{id:'c203',cat:'county',sop:'600-20',q:'In the ERG, the green-bordered pages provide:',o:['Street maps','Phone numbers','Initial isolation and protective action distances','Weather forecasts'],a:2,e:'Green pages give the initial isolation and protective-action distances.',d:3},
{id:'c204',cat:'county',sop:'600-17',q:'In a high-rise, wind entering a broken window on the fire floor can:',o:['Help firefighters advance','Cool the fire down','Have no effect on conditions','Create a wind-driven fire pushing extreme heat into hallways'],a:3,e:'Wind can turn a room fire into a blowtorch aimed down the hallway.',d:3},
{id:'c205',cat:'county',sop:'600-25',q:'The most dangerous area around an operating helicopter is:',o:['The front of the aircraft','The tail rotor area, which is difficult to see','The skids','The cockpit door'],a:1,e:'The tail rotor is nearly invisible and lethal \u2014 never approach from the rear.',d:3},
{id:'c206',cat:'county',sop:'600-15',q:'"Spot fires" ahead of a wildland fire are started by:',o:['Embers carried ahead by the wind','Arson only','Lightning only','Backfires set by crews'],a:0,e:'Wind-blown embers start new fires ahead of the main front.',d:3},
{id:'c207',cat:'county',sop:'600-16',q:'A terrorism incident (600-16) differs from a civil disturbance (600-24) in that terrorism response must also address:',o:['Crowd dispersal only','Traffic control','Secondary devices and possible CBRNE contamination','Nothing different'],a:2,e:'Terrorism adds secondary devices and CBRNE to the threat picture.',d:3},
{id:'c208',cat:'county',sop:'600-12',q:'Rehab (600-12) supports the Safety SOP (600-03) by:',o:['Punishing tired crews','Reducing fatigue-related injuries through rest and medical monitoring','Speeding up the fire attack','Replacing the safety officer'],a:1,e:'Rested, monitored crews get hurt less \u2014 that is risk management in action.',d:3},
{id:'c209',cat:'county',sop:'600-08',q:'Even with a preemption green light, the driver remains responsible for:',o:['Nothing \u2014 green means proceed without caution','Due regard for the safety of all others on the road','Maximum speed through the intersection','Ignoring cross traffic'],a:1,e:'Preemption requests a green; due regard still belongs to the driver.',d:3},
{id:'c210',cat:'county',sop:'600-14',q:'A "supervisory" signal on a fire alarm panel, such as a closed sprinkler valve, requires:',o:['Ignoring it completely','Immediate full evacuation','Investigation, like any other abnormal alarm signal','Calling the media'],a:2,e:'A supervisory signal means something is wrong with protection systems \u2014 check it.',d:3},
];

const QDEPT = [
{id:'d01',cat:'dept',sop:'100',q:'SOP 100 requires the on-duty chief to notify administration of which of the following?',o:['Any non-medical fatality at an incident','A routine medical call with no complications','A station tour for school children','A minor equipment check that passed'],a:0,e:'Non-medical fatalities are specifically listed as non-routine events requiring admin notification.',d:1},
{id:'d02',cat:'dept',sop:'100',q:'A large-scale mutual-aid incident occurs. Under SOP 100, the on-duty chief should:',o:['Notify the chain of command up to administration','Handle it quietly with no notifications','Wait until the next business day to mention it','Only tell the neighboring department'],a:0,e:'Large-scale mutual-aid responses are non-routine events that trigger the notification chain.',d:1},
{id:'d03',cat:'dept',sop:'100',q:'An on-duty firefighter is injured and requires treatment or transport. Per SOP 100:',o:['Administration must be notified','No notification is needed for minor injuries','Only the union representative is notified','The crew handles it with no report'],a:0,e:'On-duty injuries requiring treatment or transport must be pushed up the chain.',d:1},
{id:'d04',cat:'dept',sop:'100',q:'An incident occurs on department property. SOP 100 says:',o:['It requires administrative notification','It is exempt from all reporting','Only maintenance needs to know','It should be kept off the record'],a:0,e:'Incidents on department property are on the notification list regardless of severity.',d:1},
{id:'d05',cat:'dept',sop:'100',q:'A department vehicle is involved in a mishap with injury or damage. Under SOP 100:',o:['Notify administration','Just buff out the damage and move on','Only notify if a civilian was involved','Report it at the next staff meeting'],a:0,e:'Vehicle mishaps involving injury or damage require admin notification.',d:1},
{id:'d06',cat:'dept',sop:'100',q:'A company will be out of service for more than one hour. SOP 100 requires:',o:['Administrative notification','No action — it is routine','A social media post','Notification only after the company returns'],a:0,e:'A company out of service longer than an hour affects coverage, so administration must be told.',d:1},
{id:'d07',cat:'dept',sop:'100',q:'The media shows interest in an incident. Per SOP 100, the on-duty chief should:',o:['Notify administration so the PIO process can be coordinated','Give interviews immediately without telling anyone','Refuse to acknowledge the incident exists','Let any crew member speak on camera'],a:0,e:'Media interest triggers notification so messaging stays accurate and coordinated.',d:1},
{id:'d08',cat:'dept',sop:'100',q:'An MCI (mass casualty incident) or hazmat incident occurs. Under SOP 100:',o:['Administration must be notified','These are routine and need no notification','Only the hospital is notified','Notification is optional'],a:0,e:'MCI and hazmat incidents are explicitly listed as non-routine events requiring notification.',d:1},
{id:'d09',cat:'dept',sop:'100',q:'According to SOP 100, the FIRST person in the notification chain is:',o:['Deputy Chief Malpass at (727) 648-3802','The fire chief\u2019s home phone','The city manager','The county sheriff'],a:0,e:'The chain starts with Deputy Chief Malpass at (727) 648-3802.',d:1},
{id:'d10',cat:'dept',sop:'100',q:'If the first deputy chief cannot be reached, SOP 100 directs the caller to contact:',o:['Deputy Chief Breuer at (727) 417-4287','Wait and try the same number again tomorrow','The governor\u2019s office','No one else — the chain ends there'],a:0,e:'Deputy Chief Breuer at (727) 417-4287 is next in the chain.',d:1},
{id:'d11',cat:'dept',sop:'100',q:'Why does SOP 100 require notification of non-routine events?',o:['So administration can support the incident, manage resources, and handle follow-up','To punish the on-duty chief','To create extra paperwork for crews','To delay the response'],a:0,e:'Early notification lets administration support operations, manage coverage, and handle media and follow-up.',d:1},
{id:'d12',cat:'dept',sop:'100',q:'Which of these is NOT listed in SOP 100 as requiring admin notification?',o:['A routine lift-assist with no injury','A non-medical fatality','A vehicle mishap with damage','Media interest in an incident'],a:0,e:'Routine calls without injury or special circumstances are not on the notification list.',d:2},
{id:'d13',cat:'dept',sop:'100',q:'The notification chain in SOP 100 exists to make sure:',o:['Information reaches administration quickly and in the right order','Everyone in the county hears about it','The news gets the story first','Crews can avoid paperwork'],a:0,e:'A defined chain means the right people are told promptly, in order.',d:1},
{id:'d14',cat:'dept',sop:'101',q:'The department chain of command generally flows:',o:['From firefighter up through officer, battalion/district chief, deputy chief, to the fire chief','From the fire chief down to probationary members only','Sideways between stations with no officers involved','Directly from any member to the city commission'],a:0,e:'The chain runs upward through each level of supervision to the fire chief.',d:1},
{id:'d15',cat:'dept',sop:'200',q:'Minimum staffing requirements exist primarily to:',o:['Ensure enough personnel are available to operate safely and effectively','Keep overtime costs at zero','Limit the number of firefighters per station','Satisfy insurance paperwork only'],a:0,e:'Minimum manning protects both the public and crews by keeping units capable.',d:1},
{id:'d16',cat:'dept',sop:'300',q:'Apparatus should be positioned on scene with consideration for:',o:['Safety of the crew, access for operations, and leaving room for additional units','Parking as close to the fire as physically possible','Blocking all lanes of traffic in both directions','Appearance in news photographs'],a:0,e:'Safe, functional positioning balances crew protection, operational access, and incoming units.',d:1},
{id:'d17',cat:'dept',sop:'100',q:'If two notifiable events happen on the same shift, the on-duty chief should:',o:['Notify on each event — both require administrative notification','Pick the bigger one and skip the other','Wait until end of shift and send one vague message','Only notify if the chief asks'],a:0,e:'Each non-routine event independently triggers the notification requirement.',d:2},
{id:'d18',cat:'dept',sop:'201',q:'Daily station duties and routines matter because they:',o:['Keep the station, apparatus, and equipment response-ready','Are mainly for show during inspections','Replace the need for training','Are optional when the crew is tired'],a:0,e:'Consistent daily routines keep everything ready for the next call.',d:1},
{id:'d19',cat:'dept',sop:'100',q:'SOP 100\u2019s notification requirement applies to events that are:',o:['Non-routine — outside the normal day-to-day calls','Every single call, no matter how minor','Only fires, never medical calls','Only events after midnight'],a:0,e:'The SOP targets non-routine events; routine calls do not trigger the chain.',d:1},
{id:'d20',cat:'dept',sop:'100',q:'A company is out of service for 45 minutes for a quick repair. Under SOP 100:',o:['No administrative notification is required — it is under one hour','Administration must still be notified','The state must be notified','The crew must stay out of service for a full hour'],a:0,e:'The threshold is more than one hour; 45 minutes does not trigger notification.',d:2},
{id:'d21',cat:'dept',sop:'100',q:'When notifying up the chain, the on-duty chief should be prepared to provide:',o:['Clear facts: what happened, where, who is affected, and what is being done','Only the incident address','A guess about the cause','Nothing — administration will figure it out'],a:0,e:'Clear, factual information lets administration make good decisions quickly.',d:2},
{id:'d22',cat:'dept',sop:'100',q:'The phone numbers in SOP 100\u2019s notification chain are important because:',o:['They are the direct lines to reach the deputy chiefs promptly','They are the station fax numbers','They are for pizza delivery','They change every shift'],a:0,e:'Direct numbers keep the chain fast when minutes matter.',d:1},
{id:'d23',cat:'dept',sop:'300',q:'Before placing apparatus in service each shift, crews should:',o:['Check it over — fluids, equipment, lights, and radio function','Assume the previous shift left it perfect','Only check the fuel gauge','Wash it, which counts as the full check'],a:0,e:'A proper rig check catches problems before they matter on a call.',d:1},
{id:'d24',cat:'dept',sop:'100',q:'An on-duty injury that does NOT require treatment or transport:',o:['Should still be documented per department injury procedures, even though SOP 100\u2019s admin notification targets injuries needing treatment/transport','Can be completely ignored','Requires a call to the governor','Means the firefighter is fired'],a:0,e:'SOP 100\u2019s notification threshold is treatment/transport, but all injuries still need proper documentation.',d:3},
{id:'d25',cat:'dept',sop:'101',q:'When the chain of command is unclear at a scene, members should:',o:['Ask their immediate supervisor and follow the incident command structure','Do whatever seems best individually','Call the fire chief directly every time','Stop working until it is sorted out in writing'],a:0,e:'Use the immediate supervisor and the ICS structure — never freelance outside it.',d:2}
];

const QDEPT_EXTRA = [
{id:'d26',cat:'dept',sop:'100',q:'SOP 100 places the incident-notification duty on whom?',o:['The fire chief only','Volunteer members','Retired chief officers','All District Chiefs and Acting District Chiefs'],a:3,e:'The scope covers every District Chief and anyone acting in that role on a given shift.',d:1},
{id:'d27',cat:'dept',sop:'100',q:'Crews respond to a drowning at a lake and recover the victim. Under SOP 100, the on-duty chief should:',o:['Wait for the medical examiner to finish first','Handle it as a routine call with no notification','Notify administration — drowning is a listed non-medical fatality','Only notify if the family is on scene'],a:2,e:'Drownings are explicitly listed among the non-medical fatalities that require admin notification.',d:2},
{id:'d28',cat:'dept',sop:'100',q:'A homicide scene requires an extended on-scene commitment from two companies. Per SOP 100:',o:['Notify administration — homicides are listed non-medical fatalities','Keep it quiet to protect the investigation','Notify only the police department','Wait until the next shift to report it'],a:0,e:'Homicides fall under non-medical fatalities, which trigger the notification chain.',d:2},
{id:'d29',cat:'dept',sop:'100',q:'SOP 100 lists large-scale mutual-aid incidents for notification under which condition?',o:['When our companies are or were committed to the incident','Whenever any mutual-aid call occurs anywhere in the county','Only when the other agency requests it','Only when the incident makes the news'],a:0,e:'The trigger is our companies being committed — past or present — to a large-scale mutual-aid event.',d:3},
{id:'d30',cat:'dept',sop:'100',q:'A crew backs the engine into the station bay door, damaging department property. Under SOP 100:',o:['Document it only in the station log','Fix it quietly before anyone notices','Report it only if it costs over a set dollar amount','Notify administration — damage to department property is a listed trigger'],a:3,e:'Any incident involving damage to department property requires administrative notification.',d:2},
{id:'d31',cat:'dept',sop:'100',q:'A company will be delayed 90 minutes returning to service because of a staffing shortage. Per SOP 100:',o:['No notification — staffing issues are internal','Notify administration — delays over one hour for staffing reasons are listed','Wait until the company is back in service','Only the battalion chief needs to know'],a:1,e:'Companies out of service or delayed more than one hour for mechanical or staffing reasons must be reported.',d:2},
{id:'d32',cat:'dept',sop:'100',q:'An incident involves the spouse of an elected official. SOP 100 directs the chief to:',o:['Ignore it to avoid politics','Notify administration when appropriate and without violating HIPAA','Release the patient name to the press','Handle it with no documentation'],a:1,e:'Incidents involving employees, elected officials, or family members trigger notification when appropriate and HIPAA-compliant.',d:3},
{id:'d33',cat:'dept',sop:'100',q:'SOP 100 includes a catch-all provision. It covers:',o:['Any incident the chief believes administration should know about','Only incidents already on the written list','Incidents the chief personally responded to','Nothing — the list is closed and final'],a:0,e:'The chief is expected to use judgment: anything they believe admin staff should know gets reported.',d:1},
{id:'d34',cat:'dept',sop:'100',q:'When a notifiable event occurs, SOP 100 expects notification:',o:['At the end of the 24-hour shift','Within a week, in writing','Only during business hours','As soon as practical'],a:3,e:'The policy calls for notification as soon as practical so administration can act while it matters.',d:1},
{id:'d35',cat:'dept',sop:'100',q:'If neither Deputy Chief Malpass nor Deputy Chief Breuer can be reached, the caller should:',o:['Give up and try again tomorrow','Continue down the chain to the next designated contact','Call the state emergency operations center','Assume administration already knows'],a:1,e:'The chain does not end with the deputies — the caller keeps going to the next designated contact.',d:2},
{id:'d36',cat:'dept',sop:'100',q:'A patient dies of natural causes during a routine medical call. Under SOP 100:',o:['Notify administration — every death is notifiable','Notify the county medical examiner only through dispatch','This is a medical fatality, not one of the listed non-medical triggers','Notify the media immediately'],a:2,e:'SOP 100 lists non-medical fatalities; a natural medical death on a routine call is not among the triggers.',d:3},
{id:'d37',cat:'dept',sop:'100',q:'Where does SOP 100 say current department forms can be found?',o:['In the Members area of the department website','At the county courthouse','Only in the fire chiefs office','They are mailed to each station monthly'],a:0,e:'The SOP points members to the Members area of the department website for current forms.',d:1},
{id:'d38',cat:'dept',sop:'101',q:'SOP 101 addresses incident notification to whom?',o:['The county sheriff','The state fire marshal','Mutual-aid partners','The Board of Commissioners'],a:3,e:'SOP 101 is the companion policy covering notification of the commissioners.',d:1},
{id:'d39',cat:'dept',sop:'100',q:'An Acting District Chief is covering the shift when a notifiable event occurs. Per SOP 100:',o:['Only a permanent District Chief can make the notification','The Acting District Chief carries the same notification duty','Notification waits until the regular chief returns','The senior firefighter makes the call instead'],a:1,e:'The scope explicitly includes Acting District Chiefs — the duty follows the role, not the person.',d:2},
{id:'d40',cat:'dept',sop:'100',q:'A department vehicle taps a bollard with no injury and no damage. Under SOP 100:',o:['Notify administration immediately','Treat it as a major incident','It does not meet the listed injury-or-damage threshold, though it should still be documented per driving policy','Ignore it completely'],a:2,e:'The SOP 100 trigger is mishaps resulting in injury or property damage; a no-harm bump falls below that line.',d:3},
{id:'d41',cat:'dept',sop:'100',q:'A company is out of service for exactly 60 minutes for repairs. Under SOP 100:',o:['No notification is required — the threshold is more than one hour','Notify administration at the 60-minute mark','The state must be notified','Extend the outage to 61 minutes, then notify'],a:0,e:'The trigger is more than one hour, so exactly 60 minutes does not require admin notification.',d:3},
{id:'d42',cat:'dept',sop:'100',q:'A news helicopter begins circling an incident scene. The on-duty chief should:',o:['Order crews to hide from the cameras','Give an on-camera interview immediately','Have a firefighter stream it live','Notify administration — media interest is a listed trigger'],a:3,e:'Media interest in an incident requires notification so the department can coordinate its message.',d:2},
{id:'d43',cat:'dept',sop:'100',q:'Why does SOP 100 name Deputy Chief Malpass first and Deputy Chief Breuer second?',o:['Alphabetical order','Seniority of their hire dates','It was decided by coin flip','The ordered chain gives one accountable contact at a time and avoids duplicate or conflicting notifications'],a:3,e:'A defined order means one person is contacted at a time, keeping the message clear and consistent.',d:2},
{id:'d44',cat:'dept',sop:'100',q:'An incident occurs on St. Pete College grounds. Under SOP 100:',o:['It is outside department jurisdiction, so no notification','Notify administration — associated department property is covered','Only campus security is notified','It can wait for the monthly report'],a:1,e:'The SOP names St. Pete College grounds as an example of associated property that triggers notification.',d:2},
{id:'d45',cat:'dept',sop:'100',q:'A motor vehicle crash with a fatality has companies working the scene. Per SOP 100:',o:['Notify administration — MVC fatalities are listed non-medical fatalities','Handle it as routine once the roadway reopens','Only the highway patrol needs to know','Notification is optional for traffic incidents'],a:0,e:'MVCs are explicitly listed among the non-medical fatalities requiring admin notification.',d:2},
{id:'d46',cat:'dept',sop:'100',q:'An on-duty firefighter strains a shoulder but declines treatment and transport. Regarding SOP 100 notification:',o:['Notify administration for every on-duty injury','No SOP 100 admin notification is triggered — the threshold is treatment and/or transport','The firefighter must be sent home','Call the union president instead'],a:1,e:'SOP 100 targets on-duty injuries requiring treatment or transport; lesser injuries follow normal documentation.',d:3},
{id:'d47',cat:'dept',sop:'100',q:'A hazmat leak draws a multi-company response but causes no injuries. Under SOP 100:',o:['No notification — nobody was hurt','Notify only the state environmental agency','Wait for lab results before deciding','Notify administration — hazmat incidents with committed companies are listed regardless of injuries'],a:3,e:'MCI and hazmat incidents are notifiable when companies are committed, with no injury requirement attached.',d:2},
{id:'d48',cat:'dept',sop:'100',q:'Who is responsible for making the SOP 100 notification call?',o:['The dispatch supervisor','The firefighter who took the call','The on-duty District Chief or Acting District Chief','Any bystander'],a:2,e:'The duty falls on the District Chief or Acting District Chief responsible for the shift.',d:1},
{id:'d49',cat:'dept',sop:'100',q:'Which of the following is a notifiable event under SOP 100?',o:['A working structure fire with a civilian fatality','A routine blood-pressure check at the station','A false alarm with no damage or injuries','A station tour for a school group'],a:0,e:'A civilian fire fatality is a non-medical fatality — squarely on the notification list.',d:2},
{id:'d50',cat:'dept',sop:'100',q:'Companies were committed to a large mutual-aid fire earlier but have since been released. Per SOP 100:',o:['No notification — the incident is over','Notification is still warranted — the SOP covers incidents where companies are or were committed','Only notify if the fire rekindles','The incident no longer counts'],a:1,e:'The wording covers past commitment too: are or were committed.',d:3},
{id:'d51',cat:'dept',sop:'PROMO',q:'Most fire departments require promotional candidates to meet which eligibility basics first?',o:['A college degree in any field','A recommendation from the mayor','Minimum time in grade and required certifications','Ownership of a home in the district'],a:2,e:'Eligibility usually starts with time in the current rank plus mandated certifications and good standing.',d:1},
{id:'d52',cat:'dept',sop:'PROMO',q:'The written portion of a promotional exam is designed to measure:',o:['Knowledge of SOPs, tactics, leadership, and department operations','Physical strength','Typing speed','Seniority'],a:0,e:'Written exams test job knowledge — procedures, tactics, codes, and supervisory principles.',d:1},
{id:'d53',cat:'dept',sop:'PROMO',q:'In a promotional assessment center, candidates typically:',o:['Take a multiple-choice test only','Are interviewed by one person','Lift weights for a score','Rotate through job simulations such as tactical scenarios and in-basket exercises'],a:3,e:'Assessment centers use realistic simulations to observe decision-making and leadership in action.',d:1},
{id:'d54',cat:'dept',sop:'PROMO',q:'An oral board in the promotional process evaluates:',o:['Handwriting quality','The candidates height','Uniform tailoring','Communication skills, judgment, and leadership presence'],a:3,e:'Oral boards let raters judge how a candidate thinks, speaks, and leads under questioning.',d:1},
{id:'d55',cat:'dept',sop:'PROMO',q:'Seniority points in a promotional system are intended to:',o:['Replace testing entirely','Recognize years of service as one factor among several','Guarantee promotion to the oldest member','Punish newer members'],a:1,e:'Where used, seniority points credit experience while testing still measures merit and knowledge.',d:1},
{id:'d56',cat:'dept',sop:'PROMO',q:'The most effective way to prepare for a promotional exam is to:',o:['Master department SOPs, county protocols, tactics, and leadership material','Cram the night before','Rely on seniority alone','Avoid studying to stay relaxed'],a:0,e:'Deep, steady study of the actual job references beats last-minute cramming every time.',d:1},
{id:'d57',cat:'dept',sop:'PROMO',q:'Serving in an acting officer capacity helps a promotional candidate because it:',o:['Guarantees a promotion','Provides real supervisory experience to draw on','Exempts them from the written test','Counts as vacation time'],a:1,e:'Acting time builds the decision-making and crew-management reps that exams and boards probe.',d:1},
{id:'d58',cat:'dept',sop:'PROMO',q:'Professional certifications such as Fire Officer or instructor credentials:',o:['Are irrelevant to promotion','Strengthen a candidates qualifications and show initiative','Replace the need for experience','Are only for volunteers'],a:1,e:'Certifications document formal training and signal commitment to the officer track.',d:1},
{id:'d59',cat:'dept',sop:'PROMO',q:'A candidates recent disciplinary history matters in promotions because:',o:['It is never reviewed','Serious or recent discipline can disqualify or weaken a candidacy','Only awards are considered','It is sealed from everyone'],a:1,e:'Promotional reviews typically weigh conduct and personnel-file standing alongside test scores.',d:1},
{id:'d60',cat:'dept',sop:'PROMO',q:'A composite promotional score usually means:',o:['The written, assessment, and interview components are weighted and combined into one ranking score','Only the written test counts','The chief picks a favorite number','Scores are drawn at random'],a:0,e:'Weighting each component into a single composite lets departments rank candidates fairly across different skills.',d:1},
{id:'d61',cat:'dept',sop:'PROMO',q:'When two candidates tie in a promotional process, the tie is commonly broken by:',o:['A coin flip on camera','Who lives closer to the station','Height','Seniority or the higher written examination score'],a:3,e:'Published tie-breakers — often seniority or top test score — keep the process objective.',d:1},
{id:'d62',cat:'dept',sop:'PROMO',q:'Promotional eligibility lists generally:',o:['Last forever','Expire after a set period, often one to two years','Are secret from candidates','Rank by alphabetical order'],a:1,e:'Lists expire so rankings reflect current readiness rather than aging results.',d:1},
{id:'d63',cat:'dept',sop:'PROMO',q:'After promotion, a newly promoted officer typically serves:',o:['No further evaluation ever','A probationary period in the new rank','A demotion review every month','Unpaid training for a year'],a:1,e:'Probation in the new rank confirms the member can perform at the higher level.',d:1},
{id:'d64',cat:'dept',sop:'PROMO',q:'Strong annual evaluations help a promotional candidate because they:',o:['Document sustained performance and leadership over time','Are shredded immediately','Only matter for pay raises','Cannot be seen by raters'],a:0,e:'A record of solid evaluations shows the consistent performance boards want in an officer.',d:1},
{id:'d65',cat:'dept',sop:'PROMO',q:'Maintaining physical fitness matters for promotional candidates because:',o:['It is never tested or considered','Officers must model readiness and meet department standards','Only rookies need fitness','It replaces the oral board'],a:1,e:'Fitness standards apply across ranks, and officers are expected to set the example.',d:1},
{id:'d66',cat:'dept',sop:'GEN',q:'The core purpose of the chain of command (SOP 200) is:',o:['To slow down decisions','Unity of command — each member reports to one supervisor','To let everyone give orders','To eliminate officers'],a:1,e:'Unity of command keeps orders clear and accountability intact.',d:1},
{id:'d67',cat:'dept',sop:'GEN',q:'Under the grievance procedure (SOP 201), a member with a complaint should first:',o:['File a lawsuit','Post about it online','Attempt to resolve it with their immediate supervisor','Skip straight to the fire chief'],a:2,e:'The process starts at the lowest level — the immediate supervisor — before formal steps.',d:2},
{id:'d68',cat:'dept',sop:'GEN',q:'A formal written grievance generally includes which elements?',o:['A statement of the facts, the policy allegedly violated, and the remedy requested','Only the members name','A list of unrelated complaints','Demands for another members discipline'],a:0,e:'A complete grievance states what happened, which policy was violated, and what fix is sought.',d:1},
{id:'d69',cat:'dept',sop:'GEN',q:'The appearance standard (SOP 202) exists because:',o:['The department sells uniforms','Professional appearance builds public trust and confidence','It is a fashion contest','Only recruits must look professional'],a:1,e:'How members look on duty shapes how the public perceives the whole department.',d:1},
{id:'d70',cat:'dept',sop:'GEN',q:'The code of conduct (SOP 203) applies:',o:['Only while on shift','Only inside the station','On and off duty — members represent the department at all times','Only to officers'],a:2,e:'Conduct off duty can still reflect on the department, so the standard follows the member.',d:2},
{id:'d71',cat:'dept',sop:'GEN',q:'The non-harassment policy (SOP 205) requires:',o:['Ignoring all complaints','Jokes about everything','Separate rules for each station','A respectful, harassment-free workplace for every member'],a:3,e:'Every member is entitled to a workplace free from harassment and discrimination.',d:1},
{id:'d72',cat:'dept',sop:'GEN',q:'If department operations damage a members personal property (SOP 206), the member should:',o:['Report it promptly so the claim process can begin','Hide it to avoid paperwork','Bill the fire chief personally','Post it for sale online'],a:0,e:'Prompt reporting starts the documented process for evaluating the claim.',d:2},
{id:'d73',cat:'dept',sop:'GEN',q:'Housekeeping duties (SOP 209) are:',o:['The newest members job alone','Done only before inspections','Optional on busy days','A shared responsibility of the whole crew, every shift'],a:3,e:'A clean, orderly station is the whole crews daily duty, not one persons burden.',d:1},
{id:'d74',cat:'dept',sop:'GEN',q:'Under PIO and media guidelines (SOP 800), a firefighter approached by a reporter should:',o:['Give a full on-camera interview','Refer the reporter to the public information officer','Speculate about the cause','Share patient names'],a:1,e:'Media contacts go through the PIO so information stays accurate and appropriate.',d:2},
{id:'d75',cat:'dept',sop:'GEN',q:'A Knox Box (SOP 215) is:',o:['A suggestion box at the station','A secure rapid-entry key system for locked commercial buildings','A toolbox on the engine','A ballot box for union votes'],a:1,e:'Knox Boxes give crews rapid, non-destructive access to secured occupancies.',d:1},
{id:'d76',cat:'dept',sop:'GEN',q:'When apparatus goes out of service, the crew must:',o:['Notify dispatch and the chain of command so coverage can be adjusted','Keep it quiet to avoid looking bad','Post it on social media first','Wait until the next shift'],a:0,e:'Coverage depends on knowing unit status, so out-of-service changes are communicated immediately.',d:2},
{id:'d77',cat:'dept',sop:'GEN',q:'Personal protective equipment inspection (SOP 360) requires members to:',o:['Inspect PPE only once a year','Share helmets to save money','Inspect PPE regularly and remove damaged gear from service','Wash gear with bleach weekly'],a:2,e:'Routine inspection catches compromised gear before it fails on the fireground.',d:1},
{id:'d78',cat:'dept',sop:'GEN',q:'A post-incident review is conducted primarily to:',o:['Assign blame for mistakes','Capture lessons learned and improve future performance','Fill time between calls','Punish the incident commander'],a:1,e:'Honest reviews turn experience into better tactics, not into punishment.',d:1},
{id:'d79',cat:'dept',sop:'GEN',q:'Ongoing training (SOP 368) is required because:',o:['It fills the schedule','Skills fade and standards evolve — training keeps members capable','Only new hires need training','Insurance demands paperwork'],a:1,e:'Regular training maintains perishable skills and keeps certifications current.',d:1},
{id:'d80',cat:'dept',sop:'GEN',q:'The tobacco usage policy (SOP 204) means:',o:['Department policy regulates tobacco use by members','Everyone must use tobacco','It is never discussed','Only visitors are restricted'],a:0,e:'The department sets rules on tobacco use to protect health and the professional image.',d:1},
{id:'d81',cat:'dept',sop:'GEN',q:'Every member should understand work-hours policy (SOP 364) covering:',o:['Only the chiefs schedule','Their schedule, relief procedures, and overtime rules','Nothing — it runs itself','Vacation only'],a:1,e:'Knowing schedules, relief, and overtime rules prevents staffing surprises.',d:1},
{id:'d82',cat:'dept',sop:'GEN',q:'Under flag customs (SOP 221), the station flag is flown at half-staff to:',o:['Save on flag replacements','Signal the station is closed','Mark training days','Honor fallen service members, including line-of-duty deaths'],a:3,e:'Half-staff honors the fallen — a tradition the fire service observes solemnly.',d:1},
{id:'d83',cat:'dept',sop:'GEN',q:'Petty cash (SOP 208) procedures exist to:',o:['Let anyone take cash freely','Keep small purchases documented with receipts and accountability','Hide spending','Avoid all purchases'],a:1,e:'Even small expenditures need a paper trail.',d:1},
{id:'d84',cat:'dept',sop:'GEN',q:'The public records policy (SOP 213) reminds members that:',o:['Department records may be subject to public records law — write professionally','Everything is secret forever','Emails are never records','Only paper counts'],a:0,e:'Written communications can become public, so professionalism in writing matters.',d:2},
{id:'d85',cat:'dept',sop:'GEN',q:'Department computer use policy (SOP 214) generally requires:',o:['Unlimited personal use','Systems are for official business — no inappropriate content','Sharing passwords freely','Downloading anything'],a:1,e:'Department IT resources are tools for the job, not personal playgrounds.',d:1},
{id:'d86',cat:'dept',sop:'GEN',q:'Emergency pay provisions (SOP 218) cover:',o:['Regular salary only','How callback, overtime, and emergency compensation work','Vacation payouts only','Nothing — it is blank'],a:1,e:'Members should know how emergency and overtime pay are calculated before the big storm hits.',d:1},
{id:'d87',cat:'dept',sop:'GEN',q:'After a vehicle mishap, beyond any SOP 100 notification, the department will:',o:['Ignore it if notification was made','Document and review the mishap to prevent recurrence','Blame the driver publicly','Sell the vehicle immediately'],a:1,e:'Mishap reviews look for preventable causes and training fixes.',d:2},
{id:'d88',cat:'dept',sop:'GEN',q:'Incident scene safety (SOP 365) is:',o:['Every members shared responsibility','Only the safety officers job','Optional on small calls','The police departments problem'],a:0,e:'Everyone on scene owns a piece of safety — not just one designated person.',d:1},
{id:'d89',cat:'dept',sop:'GEN',q:'Pre-incident planning (SOP 402) improves outcomes because:',o:['It replaces training','It is only for new buildings','Firefighters enjoy paperwork','Knowing target hazards, access, and water supply before the call speeds good decisions'],a:3,e:'Familiarity with a building before the alarm turns chaos into a plan.',d:1},
{id:'d90',cat:'dept',sop:'GEN',q:'When unsure about a department policy, a member should:',o:['Guess and hope','Ask social media','Use the chain of command — ask your officer','Wait until someone gets in trouble'],a:2,e:'The chain of command exists to answer questions before they become problems.',d:2}
];

const QDEPT_EXTRA2 = [
{id:'d91',cat:'dept',sop:'100',q:'A lightning strike damages the station roof. Under SOP 100, the on-duty chief should:',o:['Wait for the next business day','Handle it as a routine maintenance request only','Notify administration — damage to department property is a listed trigger','Only tell the station crew'],a:2,e:'Damage to department property is explicitly listed — a storm-damaged station roof qualifies.',d:1},
{id:'d92',cat:'dept',sop:'100',q:'A dumpster fire is put out quickly with no injuries, no damage, and no media attention. Under SOP 100:',o:['Notify administration immediately','No notification is required — this is a routine incident','Notify the state fire marshal','Shut down the station for the day'],a:1,e:'SOP 100 targets non-routine events; an uneventful dumpster fire is routine.',d:1},
{id:'d93',cat:'dept',sop:'100',q:'Which pair are BOTH listed as notification triggers in SOP 100?',o:['A non-medical fatality and media interest in an incident','A routine lift-assist and a station tour','A passed equipment check and a fuel stop','A false alarm and a school visit'],a:0,e:'Non-medical fatalities and media interest are both on the SOP 100 trigger list.',d:1},
{id:'d94',cat:'dept',sop:'100',q:'A firefighter is treated at the emergency department for an on-duty burn injury. Under SOP 100:',o:['No notification — burns are routine','Only the hospital needs to know','Wait until the firefighter returns to duty','Notify administration — an on-duty injury required treatment'],a:3,e:'On-duty injuries requiring treatment or transport must be reported up the chain.',d:1},
{id:'d95',cat:'dept',sop:'100',q:'A bus crash is declared a mass casualty incident with multiple companies committed. Under SOP 100:',o:['Keep it quiet until the scene clears','Notify administration — MCIs with committed companies are listed','Only the bus company needs to know','Notification is optional for traffic incidents'],a:1,e:'Mass casualty incidents with companies committed are explicitly listed triggers.',d:1},
{id:'d96',cat:'dept',sop:'PROMO',q:'A firefighter with half the required time in grade wants to apply for promotion. They are:',o:['Automatically promoted','Eligible if their friends vouch for them','Not yet eligible — minimum time in grade comes first','Eligible for any rank they choose'],a:2,e:'Eligibility starts with minimum time in grade plus required certifications.',d:1},
{id:'d97',cat:'dept',sop:'PROMO',q:'Promotional assessment centers use realistic job simulations because:',o:['They show how candidates actually decide and lead under realistic conditions','They are cheaper than interviews','Candidates enjoy the games','They replace all other testing'],a:0,e:'Simulations let raters observe decision-making and leadership in action, not just on paper.',d:1},
{id:'d98',cat:'dept',sop:'GEN',q:'A probationary member does not understand how to log the daily rig check. They should:',o:['Guess and hope for the best','Ask social media','Skip the log quietly','Ask their officer for a walkthrough'],a:3,e:'The chain of command exists to answer questions before they become problems.',d:1},
{id:'d99',cat:'dept',sop:'GEN',q:'Why do crews perform a rig check every shift?',o:['To waste time before breakfast','To catch problems before they matter on a call','Only because the chief is watching','It is optional and mostly symbolic'],a:1,e:'A proper check finds issues with fluids, equipment, lights, and radios before they fail on scene.',d:1},
{id:'d100',cat:'dept',sop:'100',q:'An off-duty firefighter witnesses a fatal car crash while driving home and stops to help. Regarding SOP 100 notification:',o:['The fire chief must be called immediately','Notify the county commission','No SOP 100 notification — this is not a department incident and the member is off duty','The state must be notified'],a:2,e:'SOP 100 covers on-duty district operations; an off-duty member acting as a good Samaritan is outside its scope.',d:1},
{id:'d101',cat:'dept',sop:'GEN',q:'A member who experiences harassment at work should:',o:['Report it through the proper department channels','Keep it to themselves','Retaliate personally','Post about it online first'],a:0,e:'The non-harassment policy protects every member, and complaints must go through proper channels.',d:1},
{id:'d102',cat:'dept',sop:'100',q:'A company returns to service after a 20-minute fuel stop. Under SOP 100:',o:['Notify the governor','Treat it as a major incident','Keep the company out of service another 40 minutes','No notification — it is brief and routine'],a:3,e:'The threshold is more than one hour; a short routine fuel stop is not notifiable.',d:1},
{id:'d103',cat:'dept',sop:'100',q:'A company is out of service for 61 minutes while a tire is repaired. Under SOP 100:',o:['No notification — it is only a minute over','Notify administration — the threshold is more than one hour','Only notify if it reaches two hours','The crew should stay out longer to be sure'],a:1,e:'More than one hour is the trigger; 61 minutes exceeds it.',d:2},
{id:'d104',cat:'dept',sop:'100',q:'A firefighter is transported to the ER for evaluation of a possible concussion after falling on scene. Under SOP 100:',o:['Notify administration — transport occurred','No notification since the injury seems minor','Only notify the hospital','Wait for test results first'],a:0,e:'The threshold is treatment and/or transport — a transport alone triggers notification.',d:2},
{id:'d105',cat:'dept',sop:'100',q:'A civilian rescued from a house fire dies in the hospital two days later. Under SOP 100:',o:['No notification — too much time has passed','Only the hospital handles it','Notify administration — it is a non-medical fatality connected to the incident','Notification was only required on the day of the fire'],a:2,e:'The fatality is still a non-medical fatality from the incident; the trigger does not expire after a day.',d:2},
{id:'d106',cat:'dept',sop:'100',q:'A department pickup is in a fender-bender: no injuries, but the other car’s paint is scratched. Under SOP 100:',o:['Exchange insurance and move on quietly','Only notify if someone is hurt','Buff out the scratch first','Notify administration — the mishap caused property damage'],a:3,e:'Vehicle mishaps resulting in injury or property damage are listed, even when the damage is minor.',d:2},
{id:'d107',cat:'dept',sop:'100',q:'A local TV station calls the station asking about an ongoing incident. The on-duty chief should:',o:['Give a live phone interview on the spot','Notify administration — media interest is a listed trigger','Tell the reporter nothing happened','Have a firefighter call the station back'],a:1,e:'Media interest triggers notification so the department can coordinate its message through the PIO.',d:2},
{id:'d108',cat:'dept',sop:'100',q:'A scheduled multi-company MCI drill is conducted on a Saturday. Under SOP 100:',o:['No notification required — it is a planned exercise, not a non-routine incident','Notify administration like a real MCI','Notify the state','Treat it as an actual mass casualty incident'],a:0,e:'SOP 100 covers real non-routine incidents; a scheduled training exercise is not one.',d:2},
{id:'d109',cat:'dept',sop:'100',q:'Two notifiable events occur an hour apart on the same shift. The on-duty chief should:',o:['Combine them into one vague report at end of shift','Only report the more serious one','Make a separate notification for each event, starting with Deputy Chief Malpass each time','Let the next shift handle the second one'],a:2,e:'Each event independently triggers notification, and each notification starts at the top of the chain.',d:2},
{id:'d110',cat:'dept',sop:'100',q:'Our companies were not committed to a large mutual-aid fire in another county, though it is on the news. Under SOP 100:',o:['Notify administration because it made the news','Treat it as notifiable mutual aid','Only notify if our chief drove by the scene','No notification is required by the listed triggers — our companies were not committed'],a:3,e:'The mutual-aid trigger requires our companies to be or have been committed; news coverage alone is not a listed trigger.',d:2},
{id:'d111',cat:'dept',sop:'100',q:'An on-duty firefighter is treated at the scene by the crew’s paramedic for a minor burn but declines hospital transport. Under SOP 100:',o:['No notification — transport was declined','Notify administration — treatment was required and provided','Only document it in the station log','The firefighter decides whether to notify'],a:1,e:'The threshold is treatment and/or transport; treatment at the scene satisfies it.',d:2},
{id:'d112',cat:'dept',sop:'PROMO',q:'A candidate meets the time-in-grade requirement but has not yet earned a required certification. They are:',o:['Not eligible until the certification is earned','Eligible — time in grade is all that matters','Automatically certified by experience','Eligible for a waiver without asking'],a:0,e:'Eligibility requires both minimum time in grade and the mandated certifications.',d:2},
{id:'d113',cat:'dept',sop:'PROMO',q:'A candidate wants to improve assessment-center performance. The most effective preparation is:',o:['Memorizing the station’s phone number','Watching action movies','Practicing tactical scenarios and decision-making under realistic conditions','Avoiding all practice to stay relaxed'],a:2,e:'Assessment centers probe real decision-making, so realistic practice reps matter most.',d:2},
{id:'d114',cat:'dept',sop:'PROMO',q:'During an oral board scenario, a candidate gives a long, rambling answer. The likely effect is:',o:['It impresses the board with detail','It shows thoroughness and always scores well','It has no effect on scoring','It hurts — boards value clear, decisive communication under questioning'],a:3,e:'Oral boards judge communication and judgment; rambling signals unclear thinking.',d:2},
{id:'d115',cat:'dept',sop:'GEN',q:'A member disagrees with an order given on the fireground. They should:',o:['Refuse it on the spot no matter what','Follow the lawful order and raise the concern through the chain afterward','Argue with the officer in front of the crew','Ignore it quietly'],a:1,e:'Lawful orders are followed on scene; disagreements go up the chain after, preserving unity of command.',d:2},
{id:'d116',cat:'dept',sop:'GEN',q:'A TV crew sets up across the street and films crews working an incident. Firefighters should:',o:['Stay focused on their assignments and let the PIO handle the media','Wave at the camera','Give interviews between tasks','Block the camera’s lens'],a:0,e:'Media contacts go through the PIO; crews stay on task and do not engage.',d:2},
{id:'d117',cat:'dept',sop:'GEN',q:'A citizen hands a firefighter a written public-records request at the station. The firefighter should:',o:['Release whatever records they can find','Shred the request','Refer it to the proper records custodian or officer — not release records independently','Post the request online'],a:2,e:'Records requests follow a formal process; individual members do not release records on their own.',d:2},
{id:'d118',cat:'dept',sop:'GEN',q:'During the morning check, a crew finds the station’s Knox Box key is missing. They should:',o:['Say nothing and hope it turns up','Buy a replacement online','Wait until the next inspection','Report it immediately through the chain of command'],a:3,e:'A missing rapid-entry key is a security issue — it goes up the chain right away.',d:2},
{id:'d119',cat:'dept',sop:'100',q:'A delivery driver backs into the station fence, bending it. Under SOP 100:',o:['Handle it driver-to-driver with no report','Notify administration — damage to department property is a listed trigger','Only notify the driver’s employer','Fix it quietly over the weekend'],a:1,e:'Damage to department property triggers notification regardless of who caused it.',d:2},
{id:'d120',cat:'dept',sop:'GEN',q:'After a vehicle mishap with no injuries, the crew’s first responsibility beyond any SOP 100 notification is to:',o:['Document the mishap fully and honestly','Blame the other driver','Wash the apparatus first','Avoid writing anything down'],a:0,e:'Thorough, honest documentation starts the review process that prevents recurrence.',d:2},
{id:'d121',cat:'dept',sop:'100',q:'After notifying Deputy Chief Malpass of an incident, the chief also calls Deputy Chief Breuer “to be safe.” This is:',o:['Good practice — more notification is always better','Required by the SOP','Incorrect — the ordered chain contacts one person at a time to avoid duplicate or conflicting notifications','Only wrong on weekends'],a:2,e:'The chain names one accountable contact at a time; calling down the list creates confusion.',d:3},
{id:'d122',cat:'dept',sop:'100',q:'A repair is estimated to keep a company out of service for 90 minutes. The chief decides to wait until minute 61 to notify. This is:',o:['Late — once an over-an-hour outage is known, notification goes as soon as practical','Correct — the clock must pass 60 first','Fine as long as someone eventually calls','Only a problem if the media finds out'],a:0,e:'“As soon as practical” means notifying when the trigger is known, not gaming the clock.',d:3},
{id:'d123',cat:'dept',sop:'100',q:'Two notifiable events occur. The chief notifies Malpass of the first and Breuer of the second “to spread the load.” This is:',o:['Efficient chain management','Acceptable during busy shifts','Required when two events overlap','Incorrect — every notification starts at the top of the chain with Deputy Chief Malpass'],a:3,e:'Each notification independently follows the full chain from the first contact.',d:3},
{id:'d124',cat:'dept',sop:'100',q:'A major mutual-aid incident our companies were never committed to dominates the news. The chief notifies administration anyway. This is:',o:['Forbidden — only listed triggers may ever be reported','Acceptable under the catch-all — the chief judged administration should know','A violation of the chain of command','Only allowed with a written memo first'],a:1,e:'The catch-all covers any incident the chief believes administration should know about.',d:3},
{id:'d125',cat:'dept',sop:'100',q:'A firefighter is transported for evaluation after an exposure and released with no treatment given. Was SOP 100 notification required?',o:['Yes — transport alone meets the “treatment and/or transport” threshold','No — nothing was wrong with them','Only if they missed the next shift','Only if the chief likes paperwork'],a:0,e:'The SOP says treatment and/or transport; a transport by itself satisfies the threshold.',d:3},
{id:'d126',cat:'dept',sop:'PROMO',q:'Candidate A has the top written score; Candidate B has more seniority points but a lower written score. Who ranks higher?',o:['Candidate A, always — written score is all that counts','Candidate B, always — seniority wins','Whoever has the higher composite score — no single factor decides alone','The taller candidate'],a:2,e:'Composite scoring weights every component into one ranking; no single factor controls the outcome.',d:3},
{id:'d127',cat:'dept',sop:'PROMO',q:'A candidate argues that months of acting-officer time should exempt them from the assessment center. The correct response is:',o:['Agree — acting time is the same as testing','Exempt them from the written too','Let them skip anything they dislike','No — acting experience strengthens performance but does not replace testing components'],a:3,e:'Acting time builds reps, but every candidate completes the same testing components.',d:3},
{id:'d128',cat:'dept',sop:'GEN',q:'A member posts incident scene photos on personal social media. This most directly violates:',o:['The station cooking roster','PIO and media policy along with the code of conduct','Nothing — it is their personal account','Only the uniform policy'],a:1,e:'Media contacts go through the PIO, and off-duty conduct still reflects on the department.',d:3},
{id:'d129',cat:'dept',sop:'GEN',q:'An officer orders a firefighter into a structure the firefighter believes is about to collapse. The firefighter should:',o:['Refuse the imminently dangerous order and immediately raise the safety concern','Follow it without question','Pretend not to hear','Wait for another firefighter to go first'],a:0,e:'No one must follow an order that would clearly and imminently endanger life; the concern goes up immediately.',d:3},
{id:'d130',cat:'dept',sop:'100',q:'The chief already notified administration about an incident an hour ago. Now a news helicopter starts circling it. Under SOP 100:',o:['No further notification — the incident was already reported','Only the PIO needs to know','Notify again — media interest is its own listed trigger, separate from the earlier notification','Ignore the helicopter'],a:2,e:'Each listed trigger stands on its own; new media interest warrants its own notification.',d:3},
];

const QMOM = [
{id:'m01',cat:'mom',sop:'MOM',q:'When assessing a possible stroke, the most important piece of history to obtain is:',o:['The last-known-well time','The patient\u2019s favorite food','What the patient watched on TV','The patient\u2019s shoe size'],a:0,e:'Last-known-well time determines eligibility for time-sensitive stroke treatments.',d:1},
{id:'m02',cat:'mom',sop:'MOM',q:'The BE-FAST stroke screen includes all of the following EXCEPT:',o:['Blood pressure measurement','Balance','Eyes','Facial droop'],a:0,e:'BE-FAST covers Balance, Eyes, Face, Arms, Speech, Time — blood pressure is assessed separately.',d:2},
{id:'m03',cat:'mom',sop:'MOM',q:'For a patient with signs of anaphylaxis, the priority medication is:',o:['Epinephrine','Oral antihistamine only','Aspirin','Insulin'],a:0,e:'Epinephrine is the first-line, life-saving treatment for anaphylaxis.',d:1},
{id:'m04',cat:'mom',sop:'MOM',q:'Epinephrine for anaphylaxis is most commonly given:',o:['Intramuscularly in the lateral thigh','Intravenously as a slow drip only','Orally with water','Subcutaneously in the forearm'],a:0,e:'IM injection in the lateral thigh gives fast, reliable absorption.',d:1},
{id:'m05',cat:'mom',sop:'MOM',q:'High-quality CPR requires a compression rate of:',o:['100 to 120 per minute','60 per minute','As fast as possible without counting','40 per minute'],a:0,e:'100–120 compressions per minute with full recoil is the standard for effective CPR.',d:1},
{id:'m06',cat:'mom',sop:'MOM',q:'In adult cardiac arrest, rescuers should minimize interruptions in compressions and aim for a chest compression fraction of:',o:['Greater than 80%','Less than 40%','Exactly 50%','It does not matter'],a:0,e:'Keeping the compression fraction above 80% maximizes blood flow during arrest.',d:2},
{id:'m07',cat:'mom',sop:'MOM',q:'For a patient who is competent and refusing care, the refusal is valid only if:',o:['The patient has decision-making capacity and is informed of the risks of refusal','The patient signs anything quickly','A family member agrees with the refusal','The crew is busy with another call'],a:0,e:'Valid refusal requires capacity plus an understanding of the risks — and it must be documented.',d:3},
{id:'m08',cat:'mom',sop:'MOM',q:'Documentation of a patient refusal should include:',o:['Capacity assessment, risks explained, and a witness signature when possible','Only the patient\u2019s name','Nothing — refusals need no documentation','The crew\u2019s personal opinions'],a:0,e:'Thorough refusal documentation protects the patient and the crew.',d:2},
{id:'m09',cat:'mom',sop:'MOM',q:'TXA (tranexamic acid) is generally considered for:',o:['Bleeding trauma patients within a few hours of injury','All headaches','Minor nosebleeds only','Patients with no bleeding at all'],a:0,e:'TXA is an antifibrinolytic used for significant bleeding in trauma, given early.',d:2},
{id:'m10',cat:'mom',sop:'MOM',q:'A known contraindication to TXA administration is:',o:['Giving it many hours after the injury, well outside the treatment window','A scraped knee','A patient who is fully alert','Mild pain'],a:0,e:'TXA\u2019s benefit is time-limited — it should be given early after injury, not many hours later.',d:3},
{id:'m11',cat:'mom',sop:'MOM',q:'Pediatric medication doses are primarily based on:',o:['The child\u2019s weight','The child\u2019s age alone','A standard adult dose cut in half','The parent\u2019s estimate'],a:0,e:'Weight-based dosing keeps pediatric medications safe and effective.',d:1},
{id:'m12',cat:'mom',sop:'MOM',q:'When a length-based resuscitation tape is unavailable, an alternative for estimating pediatric weight is:',o:['A validated pediatric weight-estimation method or recent known weight','Guessing based on height alone','Using the adult dose','Asking the child to choose'],a:0,e:'Use a validated estimation tool or a recent known weight — never guess blindly.',d:2},
{id:'m13',cat:'mom',sop:'MOM',q:'For a trauma patient, the first priority in the primary survey is:',o:['Airway — with cervical spine protection if indicated','Splinting the ankle','Taking a full set of vital signs','Calling the patient\u2019s family'],a:0,e:'Airway comes first in the primary survey, protecting the C-spine when trauma is involved.',d:1},
{id:'m14',cat:'mom',sop:'MOM',q:'A trauma patient with uncontrolled external hemorrhage should first receive:',o:['Direct pressure and a tourniquet if the bleeding is from an extremity','A drink of water','Ice on the forehead','A splint before bleeding control'],a:0,e:'Stop the bleeding first — direct pressure, then a tourniquet for life-threatening extremity hemorrhage.',d:2},
{id:'m15',cat:'mom',sop:'MOM',q:'Signs of a tension pneumothorax include:',o:['Difficulty breathing, absent breath sounds on one side, and signs of shock','A normal exam','Only a mild cough','Improved breathing when lying flat'],a:0,e:'Tension pneumothorax is a life threat: respiratory distress, unilateral absent sounds, and shock.',d:2},
{id:'m16',cat:'mom',sop:'MOM',q:'For a patient in anaphylaxis who is hypotensive, positioning and care include:',o:['Supine with legs elevated unless breathing is compromised, plus epinephrine','Standing upright','Prone on the stomach','Sitting in a car seat'],a:0,e:'Supine positioning supports perfusion; epinephrine remains the priority drug.',d:2},
{id:'m17',cat:'mom',sop:'MOM',q:'Oxygen therapy for most patients should be:',o:['Titrated to the patient\u2019s condition and oxygen saturation','Given at maximum flow to everyone','Withheld from all COPD patients entirely','Given only if the patient asks'],a:0,e:'Titrate oxygen to need — enough to correct hypoxia without unnecessary excess.',d:2},
{id:'m18',cat:'mom',sop:'MOM',q:'For a diabetic patient with altered mental status and suspected hypoglycemia who cannot swallow safely:',o:['Do not give oral glucose — use an appropriate parenteral option per protocol','Pour juice down their throat anyway','Give insulin immediately','Wait and see if they wake up'],a:0,e:'Never give oral sugar to someone who cannot protect their airway; use protocol-directed alternatives.',d:3},
{id:'m19',cat:'mom',sop:'MOM',q:'Signs suggesting sepsis include:',o:['Fever or hypothermia, rapid heart rate, rapid breathing, and signs of infection','Only a paper cut','A normal temperature with no other findings','Hunger and thirst'],a:0,e:'Sepsis is suggested by infection plus abnormal vitals and altered perfusion — recognize it early.',d:2},
{id:'m20',cat:'mom',sop:'MOM',q:'For chest pain of suspected cardiac origin, a 12-lead ECG should be obtained:',o:['As early as possible — ideally within minutes of patient contact','After arriving at the hospital','Only if the patient requests it','The next day'],a:0,e:'Early 12-lead acquisition speeds recognition of STEMI and cath-lab activation.',d:1},
{id:'m21',cat:'mom',sop:'MOM',q:'Aspirin is commonly given for suspected cardiac chest pain because it:',o:['Inhibits platelet aggregation','Lowers blood sugar','Treats infection','Reverses opioids'],a:0,e:'Aspirin\u2019s antiplatelet effect is the reason it is given early in suspected ACS.',d:1},
{id:'m22',cat:'mom',sop:'MOM',q:'Naloxone is indicated for:',o:['Opioid overdose with respiratory depression','Allergic reactions','Diabetic emergencies','Stroke'],a:0,e:'Naloxone reverses opioid-induced respiratory depression.',d:1},
{id:'m23',cat:'mom',sop:'MOM',q:'After naloxone reverses an overdose, the patient must be monitored because:',o:['Naloxone wears off sooner than many opioids, so the patient can relapse into overdose','They are fully cured','Opioids are no longer in the body','Monitoring is a waste of time'],a:0,e:'Naloxone\u2019s short duration means re-sedation is possible — keep watching the patient.',d:2},
{id:'m24',cat:'mom',sop:'MOM',q:'The "rule of nines" is used in burns to estimate:',o:['The percentage of total body surface area burned','The patient\u2019s age','How much water to drink','The depth of the burn in millimeters'],a:0,e:'The rule of nines quickly estimates burn size, which guides fluid resuscitation and triage.',d:1},
{id:'m25',cat:'mom',sop:'MOM',q:'For a seizing patient, the priority during the seizure is to:',o:['Protect from injury and maintain the airway — do not restrain or place objects in the mouth','Hold the patient down firmly','Put a wallet between the teeth','Give oral medications immediately'],a:0,e:'Protect, position, and wait — never force anything into the mouth or restrain the seizure.',d:2},
{id:'m26',cat:'mom',sop:'MOM',q:'Spinal motion restriction is considered for patients with:',o:['A concerning mechanism of injury or signs of spinal injury','Every headache','A stubbed toe','Mild anxiety'],a:0,e:'Mechanism and exam findings drive spinal precautions — not every complaint.',d:2},
{id:'m27',cat:'mom',sop:'MOM',q:'In a normal childbirth that is imminent in the field, the attendant should:',o:['Support the delivery, keep the newborn warm and dry, and assess breathing','Pull on the baby to speed things up','Cut the cord immediately before delivery','Leave the scene'],a:0,e:'Support the birth, prevent heat loss, and assess the newborn — warmth and airway first.',d:2},
{id:'m28',cat:'mom',sop:'MOM',q:'Heat stroke is distinguished from heat exhaustion by:',o:['Altered mental status and hot skin — it is a life-threatening emergency','Mild sweating only','That it is never serious','A normal body temperature'],a:0,e:'AMS with hyperthermia marks heat stroke — cool aggressively and transport emergently.',d:3},
{id:'m29',cat:'mom',sop:'MOM',q:'For a hypothermic patient, rescuers should:',o:['Handle gently, prevent further heat loss, and avoid rough movement','Rub the limbs vigorously','Give alcohol to warm them','Have the patient run in place'],a:0,e:'Gentle handling matters — a cold heart is irritable, and further heat loss must be stopped.',d:2},
{id:'m30',cat:'mom',sop:'MOM',q:'A patient with DKA (diabetic ketoacidosis) may present with:',o:['Fruity-smelling breath, deep rapid breathing, dehydration, and altered mentation','Low blood sugar only','No symptoms at all','A normal blood glucose'],a:0,e:'DKA\u2019s classic picture includes fruity breath, Kussmaul respirations, dehydration, and AMS.',d:2}
];

const QMOM_EXTRA = [
{id:'m31',cat:'mom',sop:'MOM',q:'For an ischemic stroke, clot-busting therapy is generally considered within a window measured from:',o:['The time EMS arrived on scene','Last-known-well time, usually within about 4.5 hours','The time the 911 call was placed','The time symptoms were first noticed by the crew'],a:1,e:'Eligibility for thrombolytics is counted from the last-known-well time, most commonly within about four and a half hours.',d:2},
{id:'m32',cat:'mom',sop:'MOM',q:'Blood glucose should be checked in a suspected stroke patient because:',o:['High sugar confirms a stroke','Stroke always causes low sugar','Hypoglycemia can mimic stroke signs','Glucose testing rules out bleeding'],a:2,e:'Low blood sugar can cause weakness and speech problems that look exactly like a stroke, and it is rapidly reversible.',d:3},
{id:'m33',cat:'mom',sop:'MOM',q:'Signs suggesting a posterior circulation stroke may include:',o:['Sudden vertigo, ataxia, and visual changes','Chest pain radiating to the arm','A barky cough with fever','Unilateral leg swelling'],a:0,e:'The posterior circulation supplies the cerebellum and brainstem, so vertigo, coordination loss, and vision changes point there.',d:2},
{id:'m34',cat:'mom',sop:'MOM',q:'When the prehospital stroke screen is positive, the crew should:',o:['Wait for a second screen before acting','Drive to the closest clinic','Let the patient decide on transport','Notify the receiving facility of an incoming stroke alert'],a:3,e:'A prehospital stroke alert lets the hospital mobilize its stroke team before arrival.',d:2},
{id:'m35',cat:'mom',sop:'MOM',q:'In the Cincinnati Prehospital Stroke Scale, an abnormal finding is:',o:['Both arms remain raised evenly','One arm drifts downward compared with the other','The patient smiles symmetrically','Speech is clear and appropriate'],a:1,e:'Facial droop, arm drift, and abnormal speech are the three tested elements; any one abnormal suggests stroke.',d:2},
{id:'m36',cat:'mom',sop:'MOM',q:'Unilateral weakness appearing right after a witnessed seizure is most likely:',o:['A new ischemic stroke','A migraine aura','Todd\u2019s paralysis, a postictal stroke mimic','Heat exhaustion'],a:2,e:'Todd\u2019s paralysis is temporary weakness after a seizure that can mimic stroke and typically resolves.',d:3},
{id:'m37',cat:'mom',sop:'MOM',q:'Asking a suspected stroke patient about blood thinners matters because:',o:['Anticoagulants raise bleeding risk and affect treatment options','Blood thinners rule out a stroke','They change the BE-FAST exam','Only ischemic strokes use blood thinners'],a:0,e:'Anticoagulant use increases hemorrhage risk and changes which stroke therapies can be offered.',d:2},
{id:'m38',cat:'mom',sop:'MOM',q:'The phrase \u201Ctime is brain\u201D in stroke care means:',o:['Stroke patients should be kept awake','Brain imaging takes too long','Stroke risk rises with age','Faster treatment preserves more brain tissue'],a:3,e:'In ischemic stroke, millions of neurons are lost each minute, so speed directly saves brain.',d:1},
{id:'m39',cat:'mom',sop:'MOM',q:'Expressed consent is best described as:',o:['Permission assumed for an unconscious patient','A court order for treatment','Permission explicitly given by a competent patient','Consent given by a family member by phone'],a:2,e:'Expressed consent is clear, direct permission from a patient who can make their own decisions.',d:1},
{id:'m40',cat:'mom',sop:'MOM',q:'For a patient who wakes up with stroke symptoms, last-known-well time is generally:',o:['The time they woke up','The time they were last seen normal before sleep','The time EMS was called','Midnight'],a:1,e:'When symptoms are found on waking, the last-known-well time is when the patient was last seen at baseline, usually bedtime.',d:2},
{id:'m41',cat:'mom',sop:'MOM',q:'On a 12-lead ECG, lead V1 is placed at:',o:['The left mid-axillary line','The right mid-clavicular line','The fourth intercostal space at the right sternal border','The fifth intercostal space at the mid-clavicular line'],a:2,e:'V1 sits at the fourth intercostal space just right of the sternum; V2 mirrors it on the left.',d:2},
{id:'m42',cat:'mom',sop:'MOM',q:'Nitroglycerin should be withheld if the patient recently took:',o:['Erectile dysfunction drugs such as sildenafil','A daily multivitamin','An antihistamine','A cholesterol medication'],a:0,e:'Combining nitrates with ED drugs can cause a dangerous drop in blood pressure.',d:3},
{id:'m43',cat:'mom',sop:'MOM',q:'Before giving nitroglycerin for chest pain, the crew should confirm:',o:['The patient has eaten recently','A 12-lead is unnecessary','The pain is at least 10 out of 10','Systolic blood pressure is adequate and there are no signs of shock'],a:3,e:'Nitroglycerin vasodilates, so it must not be given to hypotensive or poorly perfused patients.',d:3},
{id:'m44',cat:'mom',sop:'MOM',q:'Nitroglycerin is used with extra caution in inferior wall MI because:',o:['It has no effect on inferior MIs','Right ventricular involvement can make the patient preload-dependent','It only works on anterior MIs','Inferior MIs never need nitrates'],a:1,e:'When the right ventricle is infarcted, dropping preload with nitrates can cause severe hypotension.',d:3},
{id:'m45',cat:'mom',sop:'MOM',q:'If the first 12-lead is non-diagnostic but ischemic symptoms persist, the crew should:',o:['Repeat the 12-lead and reassess the patient','Stop cardiac monitoring','Give a second aspirin dose','Cancel the cardiac alert'],a:0,e:'Serial 12-leads can catch evolving ST changes that a single tracing misses.',d:3},
{id:'m46',cat:'mom',sop:'MOM',q:'Aspirin should be withheld for suspected cardiac chest pain when the patient has:',o:['High blood pressure','A history of smoking','A true aspirin allergy or active bleeding','Mild nausea'],a:2,e:'Allergy and active bleeding are contraindications; the antiplatelet benefit does not outweigh those risks.',d:3},
{id:'m47',cat:'mom',sop:'MOM',q:'Atypical heart attack symptoms are most common in:',o:['Young male athletes','Children','Patients with no risk factors','Older adults, diabetics, and women'],a:3,e:'These groups more often present with dyspnea, nausea, fatigue, or epigastric pain instead of classic chest pain.',d:3},
{id:'m48',cat:'mom',sop:'MOM',q:'Tall R waves in V1\u2013V2 with ST-segment depression may suggest:',o:['A normal variant in all patients','Posterior wall myocardial infarction','Lead misplacement only','Pericarditis'],a:1,e:'Posterior MI shows reciprocal changes anteriorly; posterior leads can confirm it.',d:3},
{id:'m49',cat:'mom',sop:'MOM',q:'In START triage, an apneic patient who remains apneic after the airway is opened is tagged:',o:['Red \u2013 immediate','Yellow \u2013 delayed','Black \u2013 expectant','Green \u2013 minor'],a:2,e:'In START, failure to resume breathing after one airway attempt places the patient in the expectant category.',d:2},
{id:'m50',cat:'mom',sop:'MOM',q:'Cardiac ischemia pain may radiate to the:',o:['Jaw, neck, shoulder, or arm','Lower legs and feet','Fingertips only','Back of the head only'],a:0,e:'Referred cardiac pain commonly travels to the jaw, neck, shoulder, back, or arm.',d:1},
{id:'m51',cat:'mom',sop:'MOM',q:'The two shockable cardiac arrest rhythms are:',o:['Ventricular fibrillation and pulseless ventricular tachycardia','Asystole and PEA','Sinus bradycardia and first-degree block','Atrial fibrillation and SVT'],a:0,e:'Only VF and pulseless VT benefit from defibrillation; the other rhythms do not.',d:1},
{id:'m52',cat:'mom',sop:'MOM',q:'For asystole or pulseless electrical activity, the priority is:',o:['Immediate defibrillation','A precordial thump','Withholding all medications','High-quality CPR with epinephrine per protocol'],a:3,e:'Non-shockable rhythms are treated with continuous CPR, epinephrine, and a search for reversible causes.',d:2},
{id:'m53',cat:'mom',sop:'MOM',q:'In adult cardiac arrest, epinephrine is typically repeated every:',o:['30 seconds','3 to 5 minutes','15 minutes','Hour'],a:1,e:'Epinephrine 1 mg is repeated every 3 to 5 minutes during adult resuscitation.',d:2},
{id:'m54',cat:'mom',sop:'MOM',q:'For VF that persists despite defibrillation and CPR, the protocol may call for:',o:['Atropine','Adenosine','Amiodarone or lidocaine','Metoprolol'],a:2,e:'Amiodarone or lidocaine are the antiarrhythmics used for shock-refractory VF or pulseless VT.',d:2},
{id:'m55',cat:'mom',sop:'MOM',q:'An end-tidal CO2 below 10 mmHg during cardiac arrest suggests:',o:['Excellent CPR quality','Return of circulation','Hyperventilation only','Ineffective compressions or very low perfusion'],a:3,e:'Persistently low EtCO2 reflects poor pulmonary blood flow, usually from inadequate compressions.',d:2},
{id:'m56',cat:'mom',sop:'MOM',q:'After return of spontaneous circulation, oxygen should be:',o:['Titrated to avoid both hypoxia and hyperoxia','Kept at 100% indefinitely','Removed immediately','Given only if the patient wakes up'],a:0,e:'Both too little and too much oxygen worsen outcomes after ROSC, so it is titrated to normal saturation.',d:3},
{id:'m57',cat:'mom',sop:'MOM',q:'In cardiac arrest of a visibly pregnant patient, rescuers should:',o:['Stop compressions to check the fetus','Manually displace the uterus to the patient\u2019s left','Place her on her right side','Avoid defibrillation'],a:1,e:'Left uterine displacement relieves vena cava compression so compressions can generate output.',d:2},
{id:'m58',cat:'mom',sop:'MOM',q:'For a severely hypothermic patient (below about 30\u00B0C) in cardiac arrest:',o:['Defibrillate repeatedly at double energy','Give all drugs at double dose','Defibrillation is generally withheld until rewarming','CPR is contraindicated'],a:2,e:'A profoundly cold heart is unresponsive to shocks and drugs, which are held until the core warms.',d:3},
{id:'m59',cat:'mom',sop:'MOM',q:'Implied consent applies to:',o:['A competent adult refusing care','A minor with a parent present','A routine scheduled transport','An unconscious patient with life-threatening injuries'],a:3,e:'The law assumes an unresponsive, critically ill or injured patient would consent to lifesaving care.',d:1},
{id:'m60',cat:'mom',sop:'MOM',q:'Just before an AED delivers a shock, rescuers must:',o:['Continue compressions through the shock','Make sure no one is touching the patient','Remove the AED pads','Ventilate the patient rapidly'],a:1,e:'Everyone must be clear of the patient so no rescuer receives the shock.',d:1},
{id:'m61',cat:'mom',sop:'MOM',q:'An adult with an advanced airway in place should be ventilated at:',o:['One breath every 2 seconds','30 breaths per minute','One breath every 10 seconds','About one breath every 6 seconds'],a:3,e:'With an advanced airway, adults are ventilated at roughly 10 breaths per minute.',d:2},
{id:'m62',cat:'mom',sop:'MOM',q:'A child with an advanced airway in place should be ventilated at about:',o:['6 breaths per minute','20 to 30 breaths per minute','40 breaths per minute','One breath every 10 seconds'],a:1,e:'Children and infants with an advanced airway need faster rates, about 20 to 30 per minute.',d:2},
{id:'m63',cat:'mom',sop:'MOM',q:'An oropharyngeal airway is sized by measuring from:',o:['The corner of the mouth to the earlobe','The nose to the chin','The teeth to the throat','The chin to the chest'],a:0,e:'Corner of mouth to earlobe approximates the distance to the back of the tongue.',d:1},
{id:'m64',cat:'mom',sop:'MOM',q:'A nasopharyngeal airway is sized by measuring from:',o:['The chin to the ear','The mouth to the nose','The tip of the nose to the earlobe','The forehead to the chin'],a:2,e:'Tip of nose to earlobe estimates the passage length through the nasal airway.',d:1},
{id:'m65',cat:'mom',sop:'MOM',q:'An oropharyngeal airway should NOT be used in a patient who:',o:['Is completely unresponsive','Has an intact gag reflex','Is in cardiac arrest','Needs suctioning'],a:1,e:'In a patient who can gag, an OPA can provoke vomiting and laryngospasm.',d:3},
{id:'m66',cat:'mom',sop:'MOM',q:'Oropharyngeal suctioning in an adult should be limited to:',o:['60 seconds continuously','Until the canister is full','5 minutes per attempt','About 15 seconds at a time'],a:3,e:'Suctioning removes oxygen too, so attempts are kept brief with reoxygenation between.',d:2},
{id:'m67',cat:'mom',sop:'MOM',q:'The most effective bag-valve-mask technique uses:',o:['Two rescuers \u2014 one seals the mask while the other squeezes the bag','One rescuer for speed','The bag without a mask','Three rescuers minimum'],a:0,e:'Two-person BVM gives a better mask seal and more controlled ventilations.',d:1},
{id:'m68',cat:'mom',sop:'MOM',q:'A \u201Cshark fin\u201D capnography waveform suggests:',o:['A perfect airway seal','Normal ventilation','Bronchospasm or lower airway obstruction','Cardiac arrest'],a:2,e:'The slurred upstroke of a shark-fin waveform reflects obstructed exhalation, as in asthma.',d:2},
{id:'m69',cat:'mom',sop:'MOM',q:'The most reliable field confirmation of endotracheal tube placement is:',o:['Listening for breath sounds once','Continuous waveform capnography','Seeing chest rise once','Tube depth markings alone'],a:1,e:'Sustained square-wave capnography confirms the tube is in the trachea, not the esophagus.',d:3},
{id:'m70',cat:'mom',sop:'MOM',q:'Hyperventilating a patient during resuscitation is harmful because it:',o:['Raises intrathoracic pressure and reduces blood return to the heart','Lowers blood pressure helpfully','Increases oxygen too much to be safe','Causes the heart to beat faster'],a:0,e:'Excessive ventilation traps pressure in the chest, cutting venous return and cardiac output.',d:3},
{id:'m71',cat:'mom',sop:'MOM',q:'The pediatric assessment triangle evaluates:',o:['Blood pressure, glucose, and temperature','Appearance, work of breathing, and circulation to skin','Height, weight, and age','Lung sounds, heart tones, and bowel sounds'],a:1,e:'PAT gives a rapid hands-off impression of the child\u2019s overall physiologic status.',d:2},
{id:'m72',cat:'mom',sop:'MOM',q:'A normal resting heart rate for an infant is approximately:',o:['100 to 160 beats per minute','60 to 80 beats per minute','40 to 60 beats per minute','180 to 220 beats per minute'],a:0,e:'Infants normally run fast heart rates; 100 to 160 at rest is typical.',d:2},
{id:'m73',cat:'mom',sop:'MOM',q:'Most febrile seizures in children are:',o:['A sign of meningitis','Life-threatening emergencies','Brief, generalized, and self-resolving','Caused by low blood sugar'],a:2,e:'Simple febrile seizures are short, generalized, and stop on their own, though the child still needs evaluation.',d:1},
{id:'m74',cat:'mom',sop:'MOM',q:'A toxic-appearing child with drooling, stridor, and tripod positioning suggests:',o:['Croup','Asthma','A foreign body that will pass','Epiglottitis \u2014 avoid agitating the child'],a:3,e:'Epiglottitis can abruptly close the airway; keep the child calm and do not instrument the throat.',d:3},
{id:'m75',cat:'mom',sop:'MOM',q:'Intraosseous access is indicated when:',o:['IV access cannot be obtained in a critically ill or arresting patient','The patient refuses an IV','For routine medication administration','Only in adults'],a:0,e:'IO provides rapid vascular access when peripheral IV attempts fail in critical patients.',d:2},
{id:'m76',cat:'mom',sop:'MOM',q:'The two-rescuer CPR compression-to-ventilation ratio for children is:',o:['30 to 2','15 to 2','5 to 1','Continuous compressions only'],a:1,e:'Two rescuers use 15:2 for children to deliver more ventilations than the adult 30:2 ratio.',d:2},
{id:'m77',cat:'mom',sop:'MOM',q:'In children, hypotension is best described as:',o:['The earliest sign of shock','Normal during fever','A late sign of shock \u2014 tachycardia and poor perfusion come first','Unrelated to perfusion'],a:2,e:'Children compensate well, so a dropping blood pressure means shock is advanced.',d:3},
{id:'m78',cat:'mom',sop:'MOM',q:'An infant with a brief resolved unexplained event (BRUE) should:',o:['Be transported for evaluation even if now well-appearing','Be left at home if the parents prefer','Only be evaluated if it recurs','Receive CPR immediately'],a:0,e:'BRUE can herald serious illness, so these infants need same-day medical evaluation.',d:3},
{id:'m79',cat:'mom',sop:'MOM',q:'For consent to be considered informed, the patient must understand the:',o:['Crew\u2019s work schedule','Hospital\u2019s billing policy','Ambulance response time','Treatment, its risks, benefits, and alternatives'],a:3,e:'Informed consent requires the patient grasp what is proposed, why, and what could go wrong.',d:1},
{id:'m80',cat:'mom',sop:'MOM',q:'A length-based resuscitation tape estimates a child\u2019s weight from:',o:['Head circumference','Body length','Age in months','Shoe size'],a:1,e:'Length correlates closely with weight in children, which is why the tape works.',d:1},
{id:'m81',cat:'mom',sop:'MOM',q:'The APGAR score is assessed at:',o:['Birth and 30 minutes','Only if the baby cries','1 and 5 minutes after birth','After the cord is cut only'],a:2,e:'APGAR at one and five minutes tracks how the newborn is transitioning.',d:2},
{id:'m82',cat:'mom',sop:'MOM',q:'Warning signs of preeclampsia include:',o:['Low blood pressure and hunger','Mild back pain only','A runny nose','High blood pressure with headache, visual changes, or swelling'],a:3,e:'Preeclampsia is pregnancy hypertension plus end-organ signs and can progress to seizures.',d:2},
{id:'m83',cat:'mom',sop:'MOM',q:'For a prolapsed umbilical cord in the field, the attendant should:',o:['Use a gloved hand to lift the presenting part off the cord','Pull the cord back inside','Clamp the cord immediately','Push the baby back'],a:0,e:'Relieving pressure on the prolapsed cord preserves fetal oxygenation until delivery.',d:3},
{id:'m84',cat:'mom',sop:'MOM',q:'The first field step for postpartum hemorrhage is:',o:['Immediate IV antibiotics','Firm fundal massage','Trendelenburg positioning','Oral fluids'],a:1,e:'A boggy uterus needs firm massage to contract and slow bleeding.',d:2},
{id:'m85',cat:'mom',sop:'MOM',q:'The first steps in newborn resuscitation are:',o:['Chest compressions','Immediate intubation','Warm, dry, and stimulate the infant','Give oxygen by mask only'],a:2,e:'Most newborns respond to warming, drying, and stimulation before anything more invasive.',d:2},
{id:'m86',cat:'mom',sop:'MOM',q:'Hypoglycemia typically presents with:',o:['Rapid onset of confusion, sweating, and shakiness','Gradual dry mouth over days','Only high blood pressure','No warning signs at all'],a:0,e:'Low sugar strikes fast with neuroglycopenic and adrenergic signs like sweating and tremor.',d:1},
{id:'m87',cat:'mom',sop:'MOM',q:'Status epilepticus is generally defined as:',o:['Any single seizure','A seizure with fever','Seizures only in epileptics','A seizure lasting longer than 5 minutes or repeated seizures without recovery'],a:3,e:'Beyond five minutes, a seizure is unlikely to stop on its own and needs emergent treatment.',d:1},
{id:'m88',cat:'mom',sop:'MOM',q:'A seizing pregnant patient should be positioned:',o:['Flat on her back','On her left side to improve perfusion','Standing upright','Prone'],a:1,e:'Left lateral positioning improves venous return and keeps the airway clear of secretions.',d:2},
{id:'m89',cat:'mom',sop:'MOM',q:'A prehospital DNR order should be honored when:',o:['It is a properly completed order presented to the crew','The family verbally requests it','The patient looks very ill','Any nurse says one exists'],a:0,e:'Crews act on a valid, present DNR document \u2014 not on verbal reports alone.',d:3},
{id:'m90',cat:'mom',sop:'MOM',q:'An example of objective PCR documentation is:',o:['\u201CPatient appears anxious\u201D','\u201CPatient rates pain 8/10\u201D','\u201CBP 90/60, skin pale and diaphoretic\u201D','\u201CPatient seems fine\u201D'],a:2,e:'Objective findings are measurable or observable; pain scores and impressions are subjective.',d:2},
{id:'m91',cat:'mom',sop:'MOM',q:'The classic opioid toxidrome includes:',o:['Pinpoint pupils, slow breathing, and decreased consciousness','Dilated pupils and hyperactivity','High fever and dry skin','Rapid speech and tremor'],a:0,e:'Opioids depress the respiratory drive, constrict pupils, and blunt responsiveness.',d:1},
{id:'m92',cat:'mom',sop:'MOM',q:'Cocaine toxicity typically presents with:',o:['Pinpoint pupils and slow pulse','Drowsiness and slow breathing','Agitation, tachycardia, dilated pupils, and hyperthermia','Cold, clammy skin and bradycardia'],a:2,e:'Stimulants drive the sympathetic system: fast, hot, agitated, and dilated.',d:1},
{id:'m93',cat:'mom',sop:'MOM',q:'SLUDGE/DUMBELS signs point to:',o:['Opioid overdose','Organophosphate or nerve agent poisoning','Alcohol intoxication','Carbon monoxide poisoning'],a:1,e:'Salivation, lacrimation, urination, and friends reflect cholinergic overload from these agents.',d:1},
{id:'m94',cat:'mom',sop:'MOM',q:'Which statement about carbon monoxide poisoning is true?',o:['Cherry-red skin is an early reliable sign','It only affects smokers','Pulse oximetry rules it out','Headache and confusion occur early; cherry-red skin is late and unreliable'],a:3,e:'CO binds hemoglobin long before skin changes appear, so normal color means nothing.',d:3},
{id:'m95',cat:'mom',sop:'MOM',q:'Field treatment for suspected carbon monoxide poisoning is:',o:['Room air and rest','Oral fluids','High-flow oxygen','Aspirin'],a:2,e:'High-flow oxygen speeds CO elimination from hemoglobin.',d:1},
{id:'m96',cat:'mom',sop:'MOM',q:'Cyanide toxicity should be suspected in a smoke-inhalation patient with:',o:['Soot around the airway, altered mental status, and persistent hypotension','Only a mild cough','Burns limited to the hands','Normal vital signs'],a:0,e:'Soot plus altered status and shock after smoke exposure should raise cyanide concern.',d:3},
{id:'m97',cat:'mom',sop:'MOM',q:'Beta-blocker overdose typically causes:',o:['Tachycardia and hypertension','Bradycardia and hypotension','Fever and seizures','Dilated pupils'],a:1,e:'Blocking beta receptors slows the heart and drops pressure and contractility.',d:1},
{id:'m98',cat:'mom',sop:'MOM',q:'After an anaphylaxis episode appears to resolve, the patient still needs monitoring because:',o:['Epinephrine never works','Hives always return','The airway is permanently damaged','A biphasic reaction can recur hours later'],a:3,e:'A second wave of anaphylaxis can strike hours after the first, so observation continues.',d:2},
{id:'m99',cat:'mom',sop:'MOM',q:'A complete prehospital radio patch should include:',o:['Unit ID, patient age and sex, chief complaint, key vitals, and ETA','Only the patient\u2019s name','The crew\u2019s lunch plans','A full head-to-toe narrative'],a:0,e:'The receiving facility needs who you are, who the patient is, what is wrong, and when you will arrive.',d:1},
{id:'m100',cat:'mom',sop:'MOM',q:'The power lift is performed by:',o:['Bending at the waist with straight legs','Keeping the back straight and lifting with the legs','Jerking the load upward quickly','Twisting while lifting'],a:1,e:'Legs do the work while a straight back protects the spine from injury.',d:1},
{id:'m101',cat:'mom',sop:'MOM',q:'Crackles, jugular vein distention, and ankle edema in a dyspneic patient suggest:',o:['Asthma','Pneumonia','Anxiety','Congestive heart failure'],a:3,e:'Fluid backup signs \u2014 lung crackles, JVD, edema \u2014 point to the failing heart, not the airways.',d:3},
{id:'m102',cat:'mom',sop:'MOM',q:'Pursed-lip breathing and a barrel chest suggest:',o:['COPD','Anaphylaxis','Pneumothorax','Croup'],a:0,e:'Chronic air trapping reshapes the chest and changes breathing patterns in COPD.',d:1},
{id:'m103',cat:'mom',sop:'MOM',q:'CPAP is most appropriate for a dyspneic patient who is:',o:['Unresponsive','Alert with signs of pulmonary edema','Vomiting actively','Hypotensive and pale'],a:1,e:'CPAP helps alert pulmonary-edema patients by stenting airways open and pushing fluid back.',d:3},
{id:'m104',cat:'mom',sop:'MOM',q:'CPAP should be avoided when the patient is:',o:['Anxious but alert','Mildly short of breath','Hypotensive, vomiting, or has a decreased level of consciousness','Hypertensive'],a:2,e:'Positive pressure is unsafe with low blood pressure, aspiration risk, or inability to protect the airway.',d:3},
{id:'m105',cat:'mom',sop:'MOM',q:'Stridor indicates:',o:['Upper airway obstruction','Lower lobe pneumonia','A normal finding in adults','Gastric reflux'],a:0,e:'That harsh inspiratory sound comes from a narrowed upper airway.',d:1},
{id:'m106',cat:'mom',sop:'MOM',q:'Albuterol relieves bronchospasm by:',o:['Blocking histamine','Drying secretions','Sedating the patient','Stimulating beta-2 receptors in the lungs'],a:3,e:'Beta-2 stimulation relaxes bronchial smooth muscle and opens the airways.',d:1},
{id:'m107',cat:'mom',sop:'MOM',q:'A \u201Csilent chest\u201D during a severe asthma attack means:',o:['The attack has resolved','Air movement is so poor that wheezing can no longer be heard','The patient is faking','Oxygen is unnecessary'],a:1,e:'Absent wheeze with severe distress signals critical airflow limitation, not improvement.',d:3},
{id:'m108',cat:'mom',sop:'MOM',q:'A patient with pulmonary edema should generally be positioned:',o:['Sitting upright','Flat on the back','Face down','In Trendelenburg'],a:0,e:'Upright positioning eases the work of breathing and reduces venous return to the lungs.',d:1},
{id:'m109',cat:'mom',sop:'MOM',q:'An N95 respirator is required when caring for a patient with suspected:',o:['A common cold','A sprained ankle','An airborne disease such as tuberculosis','Heartburn'],a:2,e:'Airborne pathogens demand N95-level filtration; a surgical mask is not enough.',d:1},
{id:'m110',cat:'mom',sop:'MOM',q:'For hyperventilation caused by anxiety, the crew should:',o:['Have the patient breathe into a paper bag','Give high-flow oxygen','Start an IV immediately','Calm the patient and coach slow, controlled breathing'],a:3,e:'Reassurance and paced breathing correct the respiratory alkalosis driving the symptoms.',d:2},
{id:'m111',cat:'mom',sop:'MOM',q:'A burn that is white, leathery, and painless is classified as:',o:['Superficial','Full-thickness','First-degree','A sunburn'],a:1,e:'Destroyed nerve endings make full-thickness burns painless with a waxy, leathery look.',d:1},
{id:'m112',cat:'mom',sop:'MOM',q:'The Parkland formula estimates burn fluid needs using:',o:['Age plus heart rate','2 mL \u00D7 weight \u00D7 burn percent','4 mL \u00D7 weight in kg \u00D7 percent burn','Blood pressure alone'],a:2,e:'Parkland guides the first 24 hours of resuscitation from weight and burn size.',d:2},
{id:'m113',cat:'mom',sop:'MOM',q:'For a dry chemical burn, the first step is to:',o:['Brush off the chemical before irrigating','Apply ointment immediately','Wrap it tightly','Neutralize it with another chemical'],a:0,e:'Brushing first keeps water from activating the chemical and spreading the burn.',d:2},
{id:'m114',cat:'mom',sop:'MOM',q:'Electrical burn patients need cardiac monitoring because:',o:['Burns always cause heart attacks','Monitoring is only for paperwork','Electricity never affects the heart','Current passing through the body can cause dysrhythmias'],a:3,e:'Electrical current can disrupt cardiac conduction, so rhythm monitoring is essential.',d:1},
{id:'m115',cat:'mom',sop:'MOM',q:'Signs of inhalation injury include:',o:['Clear lung sounds only','Singed nasal hairs, sooty sputum, and hoarseness','A normal voice','Burns limited to the feet'],a:1,e:'Facial burns, soot, and voice changes warn of airway swelling that can progress fast.',d:3},
{id:'m116',cat:'mom',sop:'MOM',q:'A thermal burn should initially be cooled with:',o:['Cool running water, not ice','Ice packed directly on it','Butter or oil','Very hot water'],a:0,e:'Cool water halts the burning process; ice damages tissue further.',d:1},
{id:'m117',cat:'mom',sop:'MOM',q:'A frostbitten extremity should NOT be:',o:['Kept dry','Protected from refreezing','Rubbed or massaged','Evaluated at a hospital'],a:2,e:'Rubbing injures fragile frozen tissue, and refreezing after thawing worsens damage.',d:1},
{id:'m118',cat:'mom',sop:'MOM',q:'In drowning resuscitation, the priority is:',o:['Spinal immobilization first','Removing all wet clothing first','Waiting for advanced equipment','Early ventilations \u2014 do not delay for equipment'],a:3,e:'Drowning kills through hypoxia, so ventilations start immediately with what is at hand.',d:2},
{id:'m119',cat:'mom',sop:'MOM',q:'In hazmat decontamination, removing the patient\u2019s clothing eliminates:',o:['Nothing significant','The majority of surface contamination','All internal contamination','The need for any further care'],a:1,e:'Clothing holds most of the contaminant, so disrobing is the single biggest decon step.',d:1},
{id:'m120',cat:'mom',sop:'MOM',q:'Field treatment for nerve agent exposure includes:',o:['Activated charcoal','Insulin','Atropine and pralidoxime per protocol','Aspirin'],a:2,e:'Atropine dries the cholinergic flood while pralidoxime restores the blocked enzyme.',d:2},
];

const QMOM_EXTRA2 = [
{id:'m121',cat:'mom',sop:'MOM',q:'What does AED stand for?',o:['Automated external defibrillator','Advanced emergency dispatch','Airway evaluation device','Ambulance equipment depot'],a:0,e:'An AED automatically analyzes the rhythm and delivers a shock when one is advised.',d:1},
{id:'m122',cat:'mom',sop:'MOM',q:'A normal resting respiratory rate for a healthy adult is:',o:['4 to 8 breaths per minute','40 to 60 breaths per minute','12 to 20 breaths per minute','80 to 100 breaths per minute'],a:2,e:'Adults normally breathe 12 to 20 times per minute at rest.',d:1},
{id:'m123',cat:'mom',sop:'MOM',q:'What does CPR stand for?',o:['Cardiopulmonary resuscitation','Central pulse recovery','Critical patient relay','Cardiac pressure release'],a:0,e:'CPR keeps blood flowing to the brain and heart during cardiac arrest.',d:1},
{id:'m124',cat:'mom',sop:'MOM',q:'Skin that is pale, cool, and clammy suggests:',o:['A healthy athlete','Good circulation','Poor perfusion, as seen in shock','A mild sunburn'],a:2,e:'Pale, cool, clammy skin reflects blood shunted away from the skin in shock.',d:1},
{id:'m125',cat:'mom',sop:'MOM',q:'The recovery position is used for a patient who is:',o:['Unresponsive but breathing normally','In cardiac arrest','Choking on food','Having a stroke and needs to stand'],a:0,e:'The recovery position keeps the airway open and lets fluids drain in an unresponsive breathing patient.',d:1},
{id:'m126',cat:'mom',sop:'MOM',q:'A normal resting heart rate for a healthy adult is about:',o:['20 to 30 beats per minute','60 to 100 beats per minute','150 to 180 beats per minute','300 beats per minute'],a:1,e:'A resting adult pulse between 60 and 100 is considered normal.',d:1},
{id:'m127',cat:'mom',sop:'MOM',q:'In cardiac arrest care, PEA stands for:',o:['Pulseless electrical activity','Pulmonary edema assessment','Partial airway effort','Post-exercise apnea'],a:0,e:'PEA is organized electrical activity on the monitor with no palpable pulse.',d:1},
{id:'m128',cat:'mom',sop:'MOM',q:'The very first step when you find a person collapsed on the ground is to:',o:['Start chest compressions immediately','Check whether the person responds','Give rescue breaths','Call the patient\u2019s family'],a:1,e:'Confirm unresponsiveness first, then activate emergency response and begin care.',d:1},
{id:'m129',cat:'mom',sop:'MOM',q:'The main purpose of the primary survey is to:',o:['Find and treat immediate life threats','Take a full medical history','Complete the PCR','Decide which hospital has the best food'],a:0,e:'The primary survey is a rapid sweep for problems that will kill the patient first.',d:1},
{id:'m130',cat:'mom',sop:'MOM',q:'Minimum standard precautions when contacting a patient\u2019s blood include:',o:['Gloves','A surgical mask only','No precautions are needed','A full hazmat suit for every call'],a:0,e:'Gloves are the minimum barrier against bloodborne pathogens on every patient contact.',d:1},
{id:'m131',cat:'mom',sop:'MOM',q:'A pulse oximeter measures:',o:['Blood pressure','The oxygen saturation of the blood','Blood sugar','Body temperature'],a:1,e:'Pulse oximetry estimates the percentage of hemoglobin carrying oxygen.',d:1},
{id:'m132',cat:'mom',sop:'MOM',q:'The first link in the adult chain of survival is:',o:['Advanced airway placement','Early recognition and activation of emergency response','Coronary bypass surgery','Physical therapy'],a:1,e:'Survival starts with recognizing the emergency and calling for help immediately.',d:1},
{id:'m133',cat:'mom',sop:'MOM',q:'A patient speaking in full sentences without distress is most likely:',o:['In cardiac arrest','Protecting their airway and moving air adequately','Unconscious','In need of immediate intubation'],a:1,e:'Full sentences mean the airway is open and ventilations are currently adequate.',d:1},
{id:'m134',cat:'mom',sop:'MOM',q:'One sign of effective CPR in progress is:',o:['The chest recoils fully between compressions','Compressions at 200 per minute','Leaning on the chest between pushes','Stopping every 10 seconds to check a pulse'],a:0,e:'Full recoil lets the heart refill; without it, compressions move far less blood.',d:1},
{id:'m135',cat:'mom',sop:'MOM',q:'In the SAMPLE history, the first S stands for:',o:['Signs and symptoms','Surgery schedule','Social security number','Seatbelt use only'],a:0,e:'SAMPLE starts with the signs you see and the symptoms the patient reports.',d:1},
{id:'m136',cat:'mom',sop:'MOM',q:'In the OPQRST pain assessment, the P stands for:',o:['Provocation and palliation \u2014 what brings it on and what eases it','Pulse rate','Pupil size','Past surgeries'],a:0,e:'Provocation and palliation reveal what triggers or relieves the patient\u2019s pain.',d:1},
{id:'m137',cat:'mom',sop:'MOM',q:'A normal capillary refill time in a warm environment is:',o:['Less than 2 seconds','10 seconds','30 seconds','Capillary refill is never checked'],a:0,e:'Capillary refill under two seconds suggests intact peripheral perfusion.',d:1},
{id:'m138',cat:'mom',sop:'MOM',q:'Which of these is a normal finding?',o:['Pink, warm, dry skin','Blue lips at rest','No palpable pulse','Gurgling respirations'],a:0,e:'Pink, warm, dry skin reflects normal perfusion and oxygenation.',d:1},
{id:'m139',cat:'mom',sop:'MOM',q:'An 82-year-old on warfarin fell and struck his head. He is alert but has a scalp laceration. The priority concern is:',o:['The laceration needs stitches eventually','Anticoagulation raises the risk of intracranial bleeding \u2014 transport promptly for evaluation','He should drive himself to urgent care','A bandage is the only treatment needed'],a:1,e:'Blood thinners turn minor head trauma into a potentially life-threatening bleed; these patients need rapid evaluation.',d:2},
{id:'m140',cat:'mom',sop:'MOM',q:'A 58-year-old man reports epigastric pain and nausea after a heavy meal. He is sweaty and pale. You should:',o:['Diagnose indigestion and leave him home','Consider a cardiac cause and obtain a 12-lead ECG','Give him antacids and wait an hour','Tell him to drive to the clinic tomorrow'],a:1,e:'Epigastric pain with diaphoresis can be an atypical heart attack \u2014 cardiac workup comes first.',d:2},
{id:'m141',cat:'mom',sop:'MOM',q:'During CPR, the capnography reading suddenly rises from 14 to 42 mmHg and stays there. This most likely means:',o:['The compressions got worse','Return of spontaneous circulation','The monitor is broken','The patient needs more epinephrine'],a:1,e:'A sudden sustained jump in exhaled CO2 signals blood flow returning on its own \u2014 check for a pulse.',d:2},
{id:'m142',cat:'mom',sop:'MOM',q:'An unresponsive patient has loud snoring respirations. This sound most likely indicates:',o:['A clear, open airway','The tongue partially blocking the airway \u2014 reposition it','A normal variant','Pneumonia'],a:1,e:'Snoring in an unresponsive patient means soft tissue is narrowing the airway; a head tilt\u2013chin lift usually clears it.',d:2},
{id:'m143',cat:'mom',sop:'MOM',q:'A woman stung by a bee develops hives, lip swelling, and wheezing. She carries an epinephrine auto-injector. You should:',o:['Wait to see if it gets worse','Assist her with the auto-injector without delay','Give her a glass of milk','Have her lie flat and do nothing'],a:1,e:'Systemic signs after a sting mean anaphylaxis \u2014 epinephrine should not wait.',d:2},
{id:'m144',cat:'mom',sop:'MOM',q:'A pelvic binder is indicated for a trauma patient with:',o:['An isolated ankle fracture','A suspected unstable pelvic fracture','A headache','A nosebleed'],a:1,e:'Binding an unstable pelvis can tamponade bleeding from the pelvic vessels.',d:2},
{id:'m145',cat:'mom',sop:'MOM',q:'A 3-year-old with fever has a barky cough and stridor at rest but is alert. The best field approach is:',o:['Agitate the child to test the airway','Keep the child calm and transport for evaluation','Force oral fluids','Ignore it \u2014 croup is never serious'],a:1,e:'This is likely croup; keeping the child calm avoids worsening the airway narrowing.',d:2},
{id:'m146',cat:'mom',sop:'MOM',q:'During a field delivery, the umbilical cord is wrapped around the baby\u2019s neck. You should:',o:['Clamp and cut it immediately before delivery','Gently slip it over the head or shoulders, or clamp in two places and cut between if too tight','Pull the baby out quickly','Push the baby back in'],a:1,e:'A loose nuchal cord is slipped free; a tight one is double-clamped and cut so delivery can proceed.',d:2},
{id:'m147',cat:'mom',sop:'MOM',q:'An insulin-dependent diabetic missed lunch and is now sweaty, shaky, and confused but can still swallow. You should:',o:['Give insulin','Give oral glucose by protocol','Start CPR','Do nothing \u2014 it will pass'],a:1,e:'Missed meal plus insulin equals hypoglycemia; oral glucose works when the patient can swallow safely.',d:2},
{id:'m148',cat:'mom',sop:'MOM',q:'After a generalized seizure ends, the patient is drowsy but breathing. The best care is to:',o:['Restrain them until fully awake','Place them in the recovery position and monitor','Slap their face to wake them','Give food and water immediately'],a:1,e:'The postictal patient needs airway protection and observation while the brain recovers.',d:2},
{id:'m149',cat:'mom',sop:'MOM',q:'A patient has pinpoint pupils, slow shallow breathing, and track marks, and is barely responsive. You should:',o:['Give naloxone and support ventilations per protocol','Give insulin','Let them sleep it off','Give oral fluids'],a:0,e:'The triad of miosis, respiratory depression, and altered consciousness points to opioid overdose.',d:2},
{id:'m150',cat:'mom',sop:'MOM',q:'A dyspneic patient coughs pink, frothy sputum. This finding points most toward:',o:['Asthma','Pulmonary edema from heart failure','A common cold','Anxiety'],a:1,e:'Pink frothy sputum is classic for fluid backing up into the lungs from a failing left heart.',d:2},
{id:'m151',cat:'mom',sop:'MOM',q:'A partial-thickness burn is typically:',o:['White, leathery, and painless','Painful with blisters and a moist base','Just reddened skin','Always life-threatening regardless of size'],a:1,e:'Partial-thickness burns injure the dermis, producing blisters and significant pain.',d:2},
{id:'m152',cat:'mom',sop:'MOM',q:'A runner collapses on a hot day, confused with hot dry skin. Field care should focus on:',o:['Warming them up','Aggressive cooling and rapid transport','Giving a sports drink and sending them home','Waiting for them to cool on their own'],a:1,e:'Exertional heat stroke kills quickly; cool first and transport without delay.',d:2},
{id:'m153',cat:'mom',sop:'MOM',q:'An intoxicated patient refusing transport after a car crash should be handled by:',o:['Leaving immediately \u2014 refusal is refusal','Questioning decision-making capacity and involving medical control or law enforcement','Forcing them into the ambulance alone','Having a bystander sign for them'],a:1,e:'Intoxication undermines decision-making capacity, so refusal needs higher-level backup.',d:2},
{id:'m154',cat:'mom',sop:'MOM',q:'Writing \u201cpatient denies chest pain, shortness of breath, and dizziness\u201d in the PCR is an example of:',o:['Objective vital signs','A pertinent negative \u2014 relevant symptoms the patient does not have','A diagnosis','Unnecessary charting'],a:1,e:'Pertinent negatives show what was asked and ruled out, strengthening the record.',d:2},
{id:'m155',cat:'mom',sop:'MOM',q:'A cardiac alert for suspected STEMI is generally called when the patient has:',o:['Any headache','Ischemic symptoms with ST-segment elevation on the 12-lead','A normal ECG','Only a fast heart rate'],a:1,e:'The alert pairs the clinical picture with ECG evidence so the cath lab can mobilize.',d:2},
{id:'m156',cat:'mom',sop:'MOM',q:'In START triage, a patient breathing faster than 30 times per minute after the airway is opened is tagged:',o:['Green','Black','Red \u2014 immediate','Yellow'],a:2,e:'A respiratory rate over 30 in START means the patient needs immediate care.',d:2},
{id:'m157',cat:'mom',sop:'MOM',q:'A patient has new facial droop, arm drift, and slurred speech that started 40 minutes ago. You should:',o:['Recheck in an hour','Treat as a stroke alert and transport to a stroke center','Let them sleep it off','Drive to the nearest clinic'],a:1,e:'A positive stroke screen inside the treatment window demands a stroke alert and rapid transport.',d:2},
{id:'m158',cat:'mom',sop:'MOM',q:'A right-sided 12-lead ECG is most useful when the standard 12-lead shows:',o:['An anterior MI','An inferior MI, to check for right ventricular involvement','A normal tracing','Sinus tachycardia only'],a:1,e:'Right-sided leads reveal whether an inferior infarct has extended into the right ventricle.',d:2},
{id:'m159',cat:'mom',sop:'MOM',q:'In pit-crew CPR, the compressor should switch about every:',o:['10 minutes','2 minutes to avoid fatigue','30 seconds','Never \u2014 one person does it all'],a:1,e:'Rotating every two minutes keeps compressions deep while the rhythm check happens.',d:2},
{id:'m160',cat:'mom',sop:'MOM',q:'Gurgling sounds with each breath in an unresponsive patient indicate:',o:['A clear airway','Fluid in the airway that should be suctioned','Normal breathing','A fast heart rate'],a:1,e:'Gurgling means liquid is in the upper airway \u2014 suction it before ventilating.',d:2},
{id:'m161',cat:'mom',sop:'MOM',q:'After one IM epinephrine dose for anaphylaxis, there is no improvement. The crew should:',o:['Give up \u2014 nothing more can be done','Consider a repeat dose per protocol and prepare for rapid transport','Give oral antihistamines and wait','Place the patient in a car'],a:1,e:'Anaphylaxis can need repeat epinephrine; reassess and move quickly toward definitive care.',d:2},
{id:'m162',cat:'mom',sop:'MOM',q:'Cushing\u2019s triad \u2014 irregular respirations, widening pulse pressure, and bradycardia \u2014 suggests:',o:['Low blood sugar','Rising intracranial pressure','Dehydration','A broken arm'],a:1,e:'These three together warn that pressure inside the skull is climbing dangerously.',d:2},
{id:'m163',cat:'mom',sop:'MOM',q:'Signs of significant dehydration in an infant include:',o:['Tears when crying','A sunken fontanelle, dry mucous membranes, and no tears','A good appetite','Pink skin'],a:1,e:'Sunken soft spot, dry mouth, and absent tears mark meaningful fluid loss in babies.',d:2},
{id:'m164',cat:'mom',sop:'MOM',q:'A pregnant patient past 20 weeks becomes hypotensive when supine. You should:',o:['Keep her flat','Tilt her to the left side or displace the uterus','Sit her fully upright','Give large volumes of oral fluid'],a:1,e:'The heavy uterus compresses the vena cava; left tilt restores venous return.',d:2},
{id:'m165',cat:'mom',sop:'MOM',q:'Compared with hypoglycemia, hyperglycemia typically develops:',o:['In seconds','Gradually over hours to days','Only at night','Instantly after eating'],a:1,e:'High sugar crises build slowly, while low sugar strikes fast \u2014 onset speed helps tell them apart.',d:2},
{id:'m166',cat:'mom',sop:'MOM',q:'An inferior MI patient is hypotensive with jugular vein distention and clear lungs. The most likely problem and best field action are:',o:['Left heart failure \u2014 give nitroglycerin','Right ventricular infarct \u2014 give IV fluids and withhold nitrates','Anxiety \u2014 reassure only','Dehydration \u2014 give oral water'],a:1,e:'JVD with hypotension and clear lungs in inferior MI means the right ventricle needs preload, not nitrates.',d:3},
{id:'m167',cat:'mom',sop:'MOM',q:'A patient has a rapid wide-complex tachycardia with a pulse but is hypotensive and confused. The indicated field treatment is:',o:['Vagal maneuvers only','Synchronized cardioversion','Adenosine for all wide rhythms','Watchful waiting'],a:1,e:'Unstable tachycardia with a pulse gets synchronized shocks to reset the rhythm.',d:3},
{id:'m168',cat:'mom',sop:'MOM',q:'After ROSC, the 12-lead shows ST elevation. The crew should:',o:['Cancel all alerts \u2014 the arrest is over','Activate the cardiac catheterization pathway per protocol','Remove all monitoring','Give the patient breakfast'],a:1,e:'A post-arrest STEMI still needs emergent reperfusion; the cath lab pathway continues.',d:3},
{id:'m169',cat:'mom',sop:'MOM',q:'A tension pneumothorax is suspected in a ventilated trauma patient. The lifesaving field intervention is:',o:['Needle decompression of the affected side','Increasing ventilator rate','Chest compressions','A second IV line'],a:0,e:'Releasing the trapped air with needle decompression restores venous return immediately.',d:3},
{id:'m170',cat:'mom',sop:'MOM',q:'Anaphylaxis persists despite IM epinephrine and fluids. The next protocol step may be:',o:['An epinephrine infusion titrated to effect','Oral steroids only','Stopping all treatment','A cold shower'],a:0,e:'Refractory anaphylaxis can require a continuous epinephrine infusion with close monitoring.',d:3},
{id:'m171',cat:'mom',sop:'MOM',q:'TXA is strictly contraindicated in:',o:['Bleeding trauma within 3 hours','Isolated extremity hemorrhage','Gastrointestinal hemorrhage','Postpartum hemorrhage'],a:2,e:'Trials showed harm, not benefit, when TXA is used for GI bleeding \u2014 it stays a trauma drug.',d:3},
{id:'m172',cat:'mom',sop:'MOM',q:'A 2-year-old is bradycardic at 50 with poor perfusion. The most likely cause and first priority are:',o:['Primary cardiac disease \u2014 immediate transcutaneous pacing','Hypoxia \u2014 ventilate and oxygenate first','Dehydration \u2014 oral fluids','Fever \u2014 antipyretics'],a:1,e:'Pediatric bradycardia is usually the hypoxic heart slowing down; fix oxygenation before reaching for pacing.',d:3},
{id:'m173',cat:'mom',sop:'MOM',q:'A pregnant patient seizes and remains hypertensive, and delivery is not imminent. This suggests eclampsia, and field care centers on:',o:['Left-side positioning, airway protection, and magnesium per protocol','Immediate field delivery','Oral antihypertensives','Restraint'],a:0,e:'Eclampsia is treated with positioning, airway care, and magnesium to stop the seizures.',d:3},
{id:'m174',cat:'mom',sop:'MOM',q:'A key distinction between DKA and hyperosmolar hyperglycemic state (HHS) is:',o:['DKA always has normal glucose','HHS features extreme hyperglycemia with minimal ketones and a more gradual onset','They are identical','HHS always causes fruity breath'],a:1,e:'HHS brings profoundly high sugar without the ketoacidosis, usually in older patients over days.',d:3},
{id:'m175',cat:'mom',sop:'MOM',q:'Both beta-blocker and calcium channel blocker toxicity commonly cause:',o:['Tachycardia and hypertension','Bradycardia and hypotension','Fever and agitation','Dilated pupils and dry skin'],a:1,e:'Both drug classes slow the heart and drop vascular tone, so the presentations overlap.',d:3},
{id:'m176',cat:'mom',sop:'MOM',q:'In a severe asthma attack, a shark-fin waveform with rising end-tidal CO2 suggests:',o:['Improvement','Worsening obstruction with tiring \u2014 prepare to escalate care','A need for less oxygen','That intubation is contraindicated'],a:1,e:'Climbing CO2 with a slurred waveform means the patient is tiring and retaining CO2.',d:3},
{id:'m177',cat:'mom',sop:'MOM',q:'Circumferential full-thickness burns around the chest are dangerous because the eschar can:',o:['Heal faster','Restrict chest expansion and impair breathing','Prevent infection completely','Require no special care'],a:1,e:'Leathery eschar acts like a corset; the chest cannot expand, so ventilation suffers.',d:3},
{id:'m178',cat:'mom',sop:'MOM',q:'A frostbitten foot should be rewarmed using:',o:['Warm water around body temperature, with strict protection from refreezing','Rubbing with snow','A heat lamp on high','Dry heat from a fire'],a:0,e:'Controlled warm-water rewarming is the standard; refreezing after thawing causes the worst damage.',d:3},
{id:'m179',cat:'mom',sop:'MOM',q:'A 16-year-old with life-threatening injuries is alone \u2014 no parent or guardian is present. Consent for emergency care is:',o:['Withheld until a parent arrives','Covered by implied consent for true emergencies','Invalid for minors','Only given by police'],a:1,e:'In true emergencies, the law presumes consent for a minor when no guardian can be reached.',d:3},
{id:'m180',cat:'mom',sop:'MOM',q:'In a mass-casualty incident involving small children, responders should use:',o:['Adult START criteria for everyone','JumpSTART, the pediatric triage adaptation','No triage for children','Adult vital sign ranges'],a:1,e:'JumpSTART adjusts the triage thresholds for pediatric physiology and the option of rescue breaths.',d:3},
];

const BANKS = { county: QCOUNTY.concat(QCOUNTY_EXTRA, QCOUNTY_EXTRA2), dept: QDEPT.concat(QDEPT_EXTRA, QDEPT_EXTRA2), mom: QMOM.concat(QMOM_EXTRA, QMOM_EXTRA2) };
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
  return { profiles: [], currentProfileId: null, results: [], customQuestions: [], customDocs: [], admin: null, tombstones: [] };
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
  if (qb) qb.addEventListener('click', () => { closeModal(); startQuizFlow(cat, 10, sopFilter, adaptiveDefault); });
}

/* ------------------------------ Quiz engine ------------------------------- */
let quiz = null; // {cat, questions:[{...q, order:[...], d}], idx, answers:[{picked, correct}], adaptive, level}
let adaptiveDefault = (localStorage.getItem('phfr_adaptive') || 'on') === 'on';

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

function qDifficulty(q) { return (q.d >= 1 && q.d <= 3) ? q.d : 2; }

/** Shuffle a copy of an array. */
function shuffled(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    const t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

/** Prepare a bank question for display: shuffled option order, difficulty carried. */
function prepQuestion(q) {
  const order = shuffle([0, 1, 2, 3]);
  return { id: q.id, cat: q.cat, sop: q.sop, q: q.q, o: q.o, e: q.e, d: qDifficulty(q), order: order, answer: order.indexOf(q.a) };
}

/** Record that a profile has seen these questions (drives no-repeat drawing). */
function markSeen(prof, questions) {
  if (!prof) return;
  const s = getStore();
  const p = s.profiles.find(x => x.id === prof.id);
  if (!p) return;
  if (!p.seen) p.seen = {};
  questions.forEach(q => { p.seen[q.id] = (p.seen[q.id] || 0) + 1; });
  prof.seen = p.seen; // keep the caller's reference in sync
  saveStore(s);
}

/** Standard draw: unseen questions first, then least-seen. */
function drawStandardQuestions(cat, n, sopFilter, prof) {
  const pool = quizPool(cat, sopFilter);
  const seen = (prof && prof.seen) || {};
  const unseen = shuffled(pool.filter(q => !seen[q.id]));
  const seenAgain = pool.filter(q => seen[q.id])
    .sort((a, b) => (seen[a.id] - seen[b.id]));
  return unseen.concat(seenAgain).slice(0, Math.min(n, pool.length)).map(prepQuestion);
}

/** Adaptive draw: one question at the current level, preferring unseen. Returns false when the pool is exhausted. */
function drawAdaptiveNext() {
  const prof = currentProfile();
  const seen = (prof && prof.seen) || {};
  const usedIds = {};
  quiz.questions.forEach(q => { usedIds[q.id] = 1; });
  const pool = quizPool(quiz.cat, quiz.sopFilter).filter(q => !usedIds[q.id]);
  if (!pool.length) return false;
  const target = quiz.level;
  const levels = [];
  for (let dist = 0; dist <= 2; dist++) {
    if (target - dist >= 1) levels.push(target - dist);
    if (dist > 0 && target + dist <= 3) levels.push(target + dist);
  }
  const unseen = pool.filter(q => !seen[q.id]);
  for (let li = 0; li < levels.length; li++) {
    const cands = shuffled(unseen.filter(q => qDifficulty(q) === levels[li]));
    if (cands.length) {
      quiz.questions.push(prepQuestion(cands[0]));
      markSeen(prof, [cands[0]]);
      return true;
    }
  }
  // Fallback: least-seen questions nearest the target level.
  const fallback = pool.filter(q => seen[q.id]).sort((a, b) =>
    ((seen[a.id] || 0) - (seen[b.id] || 0)) ||
    (Math.abs(qDifficulty(a) - target) - Math.abs(qDifficulty(b) - target)));
  if (fallback.length) {
    quiz.questions.push(prepQuestion(fallback[0]));
    markSeen(prof, [fallback[0]]);
    return true;
  }
  return false;
}

function diffName(d) { return d === 1 ? 'Easy' : d === 3 ? 'Hard' : 'Medium'; }

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
    '<label class="flex items-start gap-3 p-3 rounded-xl border-2 border-slate-200 dark:border-slate-700 cursor-pointer">' +
    '<input type="checkbox" id="qs-adaptive" class="w-5 h-5 mt-0.5 accent-[#c9a227]"' + (adaptiveDefault ? ' checked' : '') + '>' +
    '<span class="text-sm"><strong>Adaptive difficulty</strong>' +
    '<span class="block text-xs font-normal text-slate-500 mt-0.5">Questions get harder as you answer correctly, easier when you miss — and you\'ll always see fresh questions first.</span></span></label>' +
    '<button id="qs-start" class="w-full py-3 rounded-xl bg-phfr-navy text-white font-bold text-lg hover:brightness-110 disabled:opacity-40" ' + (p ? '' : 'disabled') + '>Start Quiz</button>' +
    '</div>';

  let selCat = presetCat || 'county', selN = presetCount || 10;
  const paint = () => {
    $$('.qs-cat', root).forEach(b => b.classList.toggle('tab-active', b.dataset.cat === selCat));
    $$('.qs-n', root).forEach(b => b.classList.toggle('tab-active', parseInt(b.dataset.n, 10) === selN));
    const pool = quizPool(selCat);
    const seen = (p && p.seen) || {};
    const unseenCount = pool.filter(q => !seen[q.id]).length;
    $('#qs-note', root).textContent = pool.length < selN
      ? 'Only ' + pool.length + ' questions in this bank — the quiz will use all of them.'
      : pool.length + ' questions in bank · ' + unseenCount + ' you haven\'t seen yet — fresh questions come first.';
  };
  $$('.qs-cat', root).forEach(b => b.addEventListener('click', () => { selCat = b.dataset.cat; paint(); }));
  $$('.qs-n', root).forEach(b => b.addEventListener('click', () => { selN = parseInt(b.dataset.n, 10); paint(); }));
  paint();
  const si = $('#qs-signin', root);
  if (si) si.addEventListener('click', openAuthModal);
  const adBox = $('#qs-adaptive', root);
  if (adBox) adBox.addEventListener('change', () => {
    adaptiveDefault = adBox.checked;
    try { localStorage.setItem('phfr_adaptive', adaptiveDefault ? 'on' : 'off'); } catch (e) {}
  });
  $('#qs-start', root).addEventListener('click', () => startQuizFlow(selCat, selN, null, adBox ? adBox.checked : adaptiveDefault));
}

/** Begin a quiz: category, requested count, optional SOP filter (from Library), adaptive flag. */
function startQuizFlow(cat, n, sopFilter, adaptive) {
  if (!currentProfile()) { openAuthModal(); return toast('Sign in to take a quiz.', 'error'); }
  const pool = quizPool(cat, sopFilter);
  if (!pool.length) return toast('No questions available for this selection.', 'error');
  const prof = currentProfile();
  quiz = { cat: cat, sopFilter: sopFilter || null, requested: n, questions: [], idx: 0, answers: [], adaptive: !!adaptive, level: 2 };
  if (quiz.adaptive) {
    if (!drawAdaptiveNext()) { quiz = null; return toast('No questions available for this selection.', 'error'); }
  } else {
    const picked = drawStandardQuestions(cat, n, sopFilter, prof);
    quiz.questions = picked;
    markSeen(prof, picked);
  }
  renderQuizQuestion($('#view'));
}

function renderQuizQuestion(root) {
  const q = quiz.questions[quiz.idx];
  const total = quiz.adaptive ? quiz.requested : quiz.questions.length;
  const lvlPill = quiz.adaptive
    ? '<span class="ml-2 text-[11px] font-bold uppercase tracking-wide rounded-full px-2 py-0.5 ' +
      (quiz.level === 3 ? 'bg-red-100 text-red-700 dark:bg-red-900/40 dark:text-red-300'
        : quiz.level === 1 ? 'bg-green-100 text-green-700 dark:bg-green-900/40 dark:text-green-300'
        : 'bg-amber-100 text-amber-700 dark:bg-amber-900/40 dark:text-amber-300') + '">' +
      diffName(quiz.level) + '</span>'
    : '';
  root.innerHTML =
    '<div class="max-w-2xl mx-auto">' +
    '<div class="flex items-center justify-between mb-2 text-sm">' +
    '<span class="font-semibold">Question ' + (quiz.idx + 1) + ' of ' + total + lvlPill + '</span>' +
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
    quiz.answers.push({ id: q.id, picked: picked, correct: correct, lvl: quiz.adaptive ? quiz.level : null });
    if (quiz.adaptive) quiz.level = correct ? Math.min(3, quiz.level + 1) : Math.max(1, quiz.level - 1);
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
    const isLast = quiz.adaptive
      ? quiz.questions.length >= quiz.requested
      : quiz.idx + 1 >= quiz.questions.length;
    nx.textContent = isLast ? 'See results →' : 'Next →';
  }));

  $('#q-next', root).addEventListener('click', () => {
    if (quiz.adaptive && quiz.questions.length < quiz.requested) {
      if (!drawAdaptiveNext()) { finishQuiz(); return; }
    }
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
      e: q.e, cat: q.cat, sop: q.sop || null, d: q.d || 2, lvl: a.lvl || null
    };
  }).filter(Boolean);
  const record = {
    id: uid('r'), profileId: prof.id, date: Date.now(), category: quiz.cat,
    sopFilter: quiz.sopFilter || null, requested: quiz.requested,
    total: total, correct: correct, score: score, missed: missedIds,
    detail: detail, early: !!early, adaptive: !!quiz.adaptive, finalLevel: quiz.level
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
          '<div class="border-l-4 border-red-500 pl-3"><p class="text-sm font-semibold">' + sopTag(q.sop, q.cat) + esc(q.q) + '</p>' +
          '<p class="text-sm text-green-700 dark:text-green-300 mt-1"><strong>Correct:</strong> ' + esc(q.o[q.order[q.answer]]) + '</p>' +
          '<p class="text-xs text-slate-500 mt-1">' + esc(q.e) + '</p></div>').join('') +
        '</div></div>'
      : '<div class="bg-green-50 dark:bg-green-900/20 border border-green-300 dark:border-green-700 rounded-2xl p-5 mb-4 text-sm font-semibold text-green-800 dark:text-green-200">Perfect score — nothing to review! 💪</div>') +
    '<div class="flex gap-2 justify-center">' +
    '<button id="res-retry" class="px-5 py-2.5 rounded-xl bg-phfr-navy text-white font-bold">Retake quiz</button>' +
    '<button id="res-progress" class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">My progress</button>' +
    '<button id="res-home" class="px-5 py-2.5 rounded-xl border border-slate-300 dark:border-slate-700 font-semibold">Home</button>' +
    '</div></div>';

  const doneCat = quiz.cat, doneN = quiz.requested, doneAdaptive = quiz.adaptive;
  quiz = null;
  $('#res-retry').addEventListener('click', () => startQuizFlow(doneCat, doneN, null, doneAdaptive));
  $('#res-progress').addEventListener('click', () => navTo('progress'));
  $('#res-home').addEventListener('click', () => navTo('home'));
}

function sopLabel(sop, cat) {
  if (!sop) return '';
  if (cat === 'mom' || sop === 'MOM') return 'MOM';
  if (sop === 'PROMO') return 'Promotional Process';
  if (sop === 'GEN') return 'Department SOPs';
  return 'SOP ' + sop;
}

function sopTag(sop, cat) {
  const label = sopLabel(sop, cat);
  if (!label) return '';
  return '<span class="inline-block text-[11px] font-bold uppercase tracking-wide text-slate-500 dark:text-slate-400 bg-slate-100 dark:bg-slate-800 rounded px-2 py-0.5 mr-2 align-middle">' + esc(label) + '</span>';
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
      '<p class="text-sm font-semibold mb-2">' + sopTag(d.sop, d.cat) + (i + 1) + '. ' + esc(d.q) + ' ' +
      (d.correct
        ? '<span class="text-green-700 dark:text-green-400 font-bold">✓</span>'
        : '<span class="text-red-600 dark:text-red-400 font-bold">✗</span>') +
      (d.d ? ' <span class="text-[11px] font-semibold uppercase tracking-wide text-slate-400">· ' + esc(diffName(d.d)) + '</span>' : '') + '</p>' +
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
        '<div class="border-l-4 border-red-500 pl-3"><p class="text-sm font-semibold">' + sopTag(q.sop, q.cat) + esc(q.q) + '</p>' +
        '<p class="text-sm text-green-700 dark:text-green-300 mt-1"><strong>Correct:</strong> ' + esc(q.o[q.a]) + '</p>' +
        (q.e ? '<p class="text-xs text-slate-500 mt-1">' + esc(q.e) + '</p>' : '') + '</div>').join('')
      : '<p class="text-sm text-slate-500">Question details are not available for this older test — only tests taken from now on store the full question-by-question review.</p>';
  }

  root.innerHTML =
    '<button id="td-back" class="text-sm text-phfr-navy dark:text-sky-300 font-semibold mb-3">← Back to My Progress</button>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-6 mb-4 text-center">' +
    '<h2 class="text-xl font-bold mb-1">Test Review</h2>' +
    '<p class="text-sm text-slate-500 mb-3">' + fmtDate(r.date) + ' · ' + esc(CAT_LABELS[r.category] || r.category) +
    (r.sopFilter ? ' · ' + esc(r.sopFilter) : '') + (r.early ? ' · ended early' : '') +
    (r.adaptive ? ' · <strong>Adaptive</strong> (finished at ' + esc(diffName(r.finalLevel || 2)) + ')' : '') + '</p>' +
    '<div class="text-4xl font-extrabold mb-1">' + r.score + '%</div>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">' + r.correct + ' of ' + r.total + ' correct</p>' +
    '<span class="inline-block px-4 py-1.5 rounded-full text-sm font-bold ' + (pass ? 'bg-green-600 text-white' : 'bg-amber-500 text-white') + '">' +
    (pass ? 'PASS' : 'Below 80% — keep studying') + '</span></div>' +
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4"><h3 class="font-bold mb-3">Question-by-question (' + qCount + ')</h3>' +
    '<div class="space-y-3">' + body + '</div></div>' +
    '<div class="flex gap-2 justify-center"><button id="td-retake" class="px-5 py-2.5 rounded-xl bg-phfr-navy text-white font-bold">Retake this quiz</button></div>';

  $('#td-back', root).addEventListener('click', () => navTo('progress'));
  $('#td-retake', root).addEventListener('click', () => startQuizFlow(r.category, r.requested, r.sopFilter || null, !!r.adaptive));
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
  const tabs = [['dashboard', '📊 Dashboard'], ['users', '👥 Users'], ['docs', '📄 Documents'], ['data', '💾 Data'], ['cloud', '☁️ Cloud']];
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
  else if (adminTab === 'cloud') renderAdminCloud(body);
  else renderAdminData(body);
}

function renderAdminCloud(body) {
  const s = getStore();
  const lastSync = cloudLastSync ? fmtDate(cloudLastSync) : 'never';
  let html =
    '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 mb-4">' +
    '<h3 class="font-bold mb-2">Web sync (Firebase)</h3>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400">Status: <strong>' + esc(cloudStatusText()) + '</strong></p>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400">Last sync: ' + esc(lastSync) + '</p>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400">On this device: ' + s.profiles.length + ' profiles · ' + s.results.length + ' quiz results</p>' +
    '<p class="text-sm text-slate-600 dark:text-slate-400" id="cloud-counts">In the cloud: checking…</p>' +
    '<div class="flex gap-2 mt-4">' +
    '<button id="cloud-sync" class="px-5 py-2 rounded-lg bg-phfr-navy text-white font-bold text-sm">Sync now</button>' +
    '</div></div>';
  html += '<div class="bg-white dark:bg-slate-900 rounded-2xl shadow p-5 text-sm text-slate-600 dark:text-slate-400">' +
    'Member progress syncs automatically after each quiz. PINs are salted hashes verified on-device — the cloud never sees a raw PIN. ' +
    'Anyone with the app link can read member names and scores (same exposure as the shared app link itself).</div>';
  body.innerHTML = html;
  $('#cloud-sync', body).addEventListener('click', async () => {
    toast('Syncing…');
    await pullFirebaseOnce().catch(() => {});
    await pushFirebase().catch(() => {});
    renderAdminCloud(body);
    toast(cloudState === 'ready' ? 'Sync complete.' : 'Sync issue — ' + cloudStatusText(), cloudState === 'ready' ? 'ok' : 'error');
  });
  if (cloud) {
    (async () => {
      try {
        const [pp, rr] = await Promise.all([
          cloud.db.collection('phfr_profiles').get(),
          cloud.db.collection('phfr_results').get()
        ]);
        const el = $('#cloud-counts', body);
        if (el) el.textContent = 'In the cloud: ' + pp.size + ' profiles · ' + rr.size + ' quiz results';
      } catch (e) {
        const el = $('#cloud-counts', body);
        if (el) el.textContent = 'In the cloud: unavailable (' + (e.message || 'error') + ')';
      }
    })();
  }
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
    tombstoneProfile(st, prof); // record the deletion so it propagates to the cloud
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

/* ------------------------------ Firebase sync (optional) -------------------- */
/* Web saving of member progress via Firestore. Local-first: everything works
   offline and the cloud is a sync layer. Configure via firebase-config.js +
   one-time Firestore setup (enable Anonymous sign-in, paste firestore.rules —
   see README). */
let cloud = null; // {db, uid} when configured and signed in
let cloudState = 'off'; // off | connecting | ready | syncing | error
let cloudLastSync = parseInt(localStorage.getItem('phfr_cloud_last') || '0', 10) || 0;
let cloudTimer = null;

function initFirebaseSync() {
  const cfg = window.FIREBASE_CONFIG;
  if (!cfg || !cfg.apiKey || cfg.apiKey.indexOf('PASTE_') === 0) return; // not configured
  cloudState = 'connecting';
  refreshHeader();
  const load = src => new Promise((res, rej) => {
    const sc = document.createElement('script'); sc.src = src;
    sc.onload = res; sc.onerror = () => rej(new Error('Failed to load ' + src));
    document.head.appendChild(sc);
  });
  load('https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js')
    .then(() => load('https://www.gstatic.com/firebasejs/10.12.2/firebase-auth-compat.js'))
    .then(() => load('https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'))
    .then(async () => {
      try {
        firebase.initializeApp(cfg);
        const cred = await firebase.auth().signInAnonymously();
        cloud = { db: firebase.firestore(), uid: cred.user.uid };
        cloudState = 'ready';
        console.info('[phfr-hub] Firebase sync enabled.');
        pullFirebaseOnce().catch(e => console.warn('[phfr-hub] initial cloud pull failed:', e.message));
      } catch (e) { cloudState = 'error'; console.warn('[phfr-hub] Firebase init failed:', e); }
      refreshHeader();
    })
    .catch(e => { cloudState = 'error'; console.warn('[phfr-hub] Firebase unavailable:', e.message); refreshHeader(); });
}

function cloudStatusText() {
  if (!cloud) {
    if (cloudState === 'connecting') return 'Connecting…';
    if (cloudState === 'error') return 'Connection failed — check firebase-config.js';
    return 'Off — no firebase-config.js';
  }
  return { ready: 'Connected', syncing: 'Syncing…', error: 'Last sync failed' }[cloudState] || cloudState;
}

/** Merge one cloud profile doc into the local store (additive, by id). */
function mergeCloudProfile(st, d) {
  if (!d || !d.id) return;
  const p = st.profiles.find(x => x.id === d.id);
  if (!p) {
    st.profiles.push({
      id: d.id, name: d.name, salt: d.salt, pinHash: d.pinHash,
      created: d.created || Date.now(), seen: d.seen || {}
    });
  } else if (d.seen) {
    // Refresh the seen map (latest writer wins per question).
    p.seen = p.seen || {};
    for (const k in d.seen) p.seen[k] = Math.max(p.seen[k] || 0, d.seen[k] || 0);
  }
}

/** Apply cloud tombstones locally (a profile deleted elsewhere disappears here too). */
function applyTombstones(st, cloudTombs) {
  const localTombs = new Set((st.tombstones || []).map(t => t.id));
  cloudTombs.forEach(t => {
    if (localTombs.has(t.id)) return;
    st.tombstones.push({ id: t.id, type: t.type || 'profile' });
    const pi = st.profiles.findIndex(p => p.id === t.id);
    if (pi !== -1) {
      const pid = st.profiles[pi].id;
      st.profiles.splice(pi, 1);
      st.results = st.results.filter(r => r.profileId !== pid);
      if (st.currentProfileId === pid) st.currentProfileId = null;
    }
  });
}

async function _allDocs(coll) {
  const snap = await cloud.db.collection(coll).get();
  const out = [];
  snap.forEach(doc => { const d = doc.data(); if (d) out.push(d); });
  return out;
}

/** Full pull: tombstones, profiles, results. Additive merge; never deletes local work. */
async function pullFirebaseOnce() {
  if (!cloud || cloudState === 'syncing') return;
  cloudState = 'syncing';
  try {
    const st = getStore();
    if (!st.tombstones) st.tombstones = [];
    const tombs = await _allDocs('phfr_tombstones');
    const tombIds = new Set(tombs.map(t => t.id));
    // Upload any local tombstones the cloud hasn't seen yet.
    const batch0 = cloud.db.batch();
    let n0 = 0;
    st.tombstones.filter(t => !tombIds.has(t.id)).forEach(t => {
      batch0.set(cloud.db.collection('phfr_tombstones').doc(t.id),
        { id: t.id, type: t.type || 'profile', pinHash: t.pinHash || '', deletedAt: Date.now() }, { merge: true });
      n0++;
    });
    if (n0) await batch0.commit();
    applyTombstones(st, tombs);
    const localTombIds = new Set(st.tombstones.map(t => t.id));
    (await _allDocs('phfr_profiles')).forEach(d => { if (!localTombIds.has(d.id)) mergeCloudProfile(st, d); });
    const haveR = new Set(st.results.map(r => r.id));
    (await _allDocs('phfr_results')).forEach(d => {
      if (!d.id || haveR.has(d.id) || localTombIds.has(d.profileId)) return;
      st.results.push(d); haveR.add(d.id);
    });
    saveStore(st);
    cloudLastSync = Date.now();
    try { localStorage.setItem('phfr_cloud_last', String(cloudLastSync)); } catch (e) {}
    cloudState = 'ready';
    if (currentView === 'admin' && adminAuthed) renderAdmin($('#view'));
    if (currentView === 'progress') renderProgress($('#view'));
    refreshHeader();
  } catch (e) {
    cloudState = 'error';
    console.warn('[phfr-hub] Cloud pull failed:', e.message);
  }
}

/** Debounced push of local profiles + results. Local-first; failures are silent. */
function scheduleCloudSync() {
  if (!cloud && cloudState !== 'connecting') return;
  clearTimeout(cloudTimer);
  cloudTimer = setTimeout(pushFirebase, 1500);
}

async function pushFirebase() {
  if (!cloud || cloudState === 'syncing') return;
  cloudState = 'syncing';
  try {
    const st = getStore();
    if (!st.tombstones) st.tombstones = [];
    // 1. Tombstones first: fetch cloud's, apply locally, upload missing.
    const tombs = await _allDocs('phfr_tombstones');
    const tombIds = new Set(tombs.map(t => t.id));
    const missingTombs = st.tombstones.filter(t => !tombIds.has(t.id));
    if (missingTombs.length) {
      const b = cloud.db.batch();
      missingTombs.forEach(t => b.set(cloud.db.collection('phfr_tombstones').doc(t.id),
        { id: t.id, type: t.type || 'profile', pinHash: t.pinHash || '', deletedAt: Date.now() }, { merge: true }));
      await b.commit();
      missingTombs.forEach(t => tombIds.add(t.id));
    }
    applyTombstones(st, tombs);
    const deadIds = new Set(st.tombstones.map(t => t.id));

    // 2. Upsert every live local profile (merge:true = insert or update).
    const liveProfiles = st.profiles.filter(p => !deadIds.has(p.id));
    for (let i = 0; i < liveProfiles.length; i += 400) {
      const b = cloud.db.batch();
      liveProfiles.slice(i, i + 400).forEach(p => b.set(
        cloud.db.collection('phfr_profiles').doc(p.id),
        { id: p.id, name: p.name, salt: p.salt, pinHash: p.pinHash || '', created: p.created || Date.now(), seen: p.seen || {} },
        { merge: true }));
      await b.commit();
    }

    // 3. Insert results the cloud doesn't have yet (results are immutable).
    const cloudResIds = new Set((await _allDocs('phfr_results')).map(d => d.id));
    const fresh = st.results.filter(r => r.id && !cloudResIds.has(r.id) && !deadIds.has(r.profileId));
    for (let i = 0; i < fresh.length; i += 400) {
      const b = cloud.db.batch();
      fresh.slice(i, i + 400).forEach(r => b.set(
        cloud.db.collection('phfr_results').doc(r.id), Object.assign({}, r), { merge: true }));
      await b.commit();
    }

    // 4. Delete cloud profile docs for tombstoned ids. Idempotent: deleting
    // a missing doc is a silent no-op. Tombstones stop them resurrecting.
    for (const t of st.tombstones) {
      await cloud.db.collection('phfr_profiles').doc(t.id).delete().catch(() => {});
    }

    saveStore(st);
    cloudLastSync = Date.now();
    try { localStorage.setItem('phfr_cloud_last', String(cloudLastSync)); } catch (e) {}
    cloudState = 'ready';
  } catch (e) {
    cloudState = 'error';
    console.warn('[phfr-hub] Cloud push failed:', e.message);
  }
}

/** Record a local profile deletion so it propagates to the cloud.
 * Mutates the passed store (caller saves); never re-reads the store itself. */
function tombstoneProfile(st, prof) {
  if (!st.tombstones) st.tombstones = [];
  if (!st.tombstones.some(t => t.id === prof.id)) {
    st.tombstones.push({ id: prof.id, type: 'profile', pinHash: prof.pinHash || '' });
  }
}

/* ------------------------------ Init -------------------------------------- */
document.addEventListener('DOMContentLoaded', () => {
  applyTheme();
  $('#theme-toggle').addEventListener('click', toggleTheme);
  $('#auth-btn').addEventListener('click', openAuthModal);
  $$('.nav-btn').forEach(b => b.addEventListener('click', () => navTo(b.dataset.view)));
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
  refreshHeader();
  initFirebaseSync();
  navTo('home');
});
