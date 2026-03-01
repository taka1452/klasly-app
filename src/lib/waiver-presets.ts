export type WaiverPreset = {
  id: string;
  name: string;
  description: string;
  icon: string;
  content: string; // HTML形式。{{STUDIO_NAME}} プレースホルダーを含む
};

export const WAIVER_PRESETS: WaiverPreset[] = [
  {
    id: "general-fitness",
    name: "General Fitness Studio",
    description: "Standard liability waiver for yoga, pilates, dance, and general fitness classes",
    icon: "🏋️",
    content: `
<h2>Liability Waiver and Release Form</h2>
<h3>{{STUDIO_NAME}}</h3>

<p><strong>Please read this document carefully before signing.</strong></p>

<h4>1. Assumption of Risk</h4>
<p>I understand that physical exercise, including but not limited to yoga, pilates, dance, strength training, cardio, and other fitness activities offered by {{STUDIO_NAME}}, involves inherent risks of injury. These risks include, but are not limited to: muscle strains, sprains, fractures, joint injuries, cardiac events, and other physical harm.</p>

<p>I voluntarily choose to participate in these activities with full knowledge of the risks involved. I accept and assume all risks of injury, illness, or death that may result from my participation.</p>

<h4>2. Release of Liability</h4>
<p>In consideration of being permitted to participate in activities at {{STUDIO_NAME}}, I hereby release, waive, and discharge {{STUDIO_NAME}}, its owners, instructors, employees, and agents from any and all liability, claims, demands, or causes of action arising out of or related to any loss, damage, or injury that may be sustained by me during or as a result of my participation in any activities.</p>

<h4>3. Health Declaration</h4>
<p>I confirm that:</p>
<ul>
  <li>I am physically fit and have no medical condition that would prevent my participation in fitness activities</li>
  <li>I have consulted with a physician regarding my participation if I have any pre-existing medical conditions</li>
  <li>I will immediately notify an instructor if I experience any pain, discomfort, or unusual symptoms during any activity</li>
  <li>I am not under the influence of alcohol or drugs that may impair my ability to safely participate</li>
</ul>

<h4>4. Studio Rules and Guidelines</h4>
<p>I agree to:</p>
<ul>
  <li>Follow all instructions and guidelines provided by {{STUDIO_NAME}} instructors and staff</li>
  <li>Use equipment properly and only as instructed</li>
  <li>Inform instructors of any injuries, physical limitations, or health concerns before class</li>
  <li>Arrive on time and maintain a respectful environment for all participants</li>
</ul>

<h4>5. Photo and Video Consent</h4>
<p>I grant {{STUDIO_NAME}} permission to use photographs or video recordings taken during classes or events for promotional purposes, including social media, website, and marketing materials. I understand I may opt out of this by notifying the studio in writing.</p>

<h4>6. Emergency Contact Authorization</h4>
<p>In the event of an emergency, I authorize {{STUDIO_NAME}} to contact emergency services and/or my emergency contact on file, and to provide basic first aid as needed.</p>

<h4>7. Agreement</h4>
<p>I have read and fully understand this Waiver and Release of Liability. I understand that by signing this document, I am giving up legal rights and remedies. I sign this agreement voluntarily and without coercion.</p>

<p><strong>This waiver remains in effect for the duration of my membership or participation at {{STUDIO_NAME}}.</strong></p>
    `.trim(),
  },
  {
    id: "yoga-studio",
    name: "Yoga Studio",
    description: "Tailored for yoga studios with meditation and breathwork references",
    icon: "🧘",
    content: `
<h2>Yoga Practice Waiver and Release</h2>
<h3>{{STUDIO_NAME}}</h3>

<p><strong>Please read carefully before signing.</strong></p>

<h4>1. Nature of Yoga Practice</h4>
<p>I understand that yoga practice at {{STUDIO_NAME}} may include physical postures (asanas), breathing exercises (pranayama), meditation, and other related practices. I acknowledge that these activities require physical exertion and may involve movements that could result in injury.</p>

<h4>2. Assumption of Risk</h4>
<p>I am aware that yoga practice involves inherent risks, including but not limited to: muscle strains, sprains, joint injuries, back injuries, neck injuries, dizziness, fainting, and aggravation of pre-existing conditions. I voluntarily assume all risks associated with my participation in yoga classes and activities at {{STUDIO_NAME}}.</p>

<h4>3. Release of Liability</h4>
<p>I hereby release, waive, and discharge {{STUDIO_NAME}}, its owners, yoga instructors, employees, and agents from any liability for injury, illness, or death arising from my participation in yoga classes, workshops, or any related activities. This release applies to injuries caused by negligence or any other cause.</p>

<h4>4. Health Acknowledgment</h4>
<p>I confirm that:</p>
<ul>
  <li>I have no medical conditions that would make yoga practice inadvisable, or I have consulted my physician before participating</li>
  <li>I will inform my instructor of any injuries, pregnancy, surgeries, or health concerns before each class</li>
  <li>I understand that I should listen to my body and rest or modify poses as needed</li>
  <li>I will not push beyond my physical limits and will stop immediately if I feel pain or discomfort</li>
</ul>

<h4>5. Personal Responsibility</h4>
<p>I agree to:</p>
<ul>
  <li>Practice within my own limits and abilities</li>
  <li>Use props and modifications as recommended by instructors</li>
  <li>Keep the studio environment clean, quiet, and respectful</li>
  <li>Arrive on time and silence electronic devices during class</li>
  <li>Use my own mat or studio-provided equipment responsibly</li>
</ul>

<h4>6. Photo and Media Consent</h4>
<p>I grant {{STUDIO_NAME}} permission to use photographs or video recordings taken during classes or events for promotional purposes. I may opt out by notifying the studio in writing.</p>

<h4>7. Agreement</h4>
<p>I have read and fully understand this Waiver and Release. I sign this agreement voluntarily, with full knowledge of its significance.</p>

<p><strong>This waiver remains in effect for the duration of my membership or participation at {{STUDIO_NAME}}.</strong></p>
    `.trim(),
  },
  {
    id: "dance-studio",
    name: "Dance Studio",
    description: "For dance studios including ballet, hip-hop, contemporary, and more",
    icon: "💃",
    content: `
<h2>Dance Studio Waiver and Release of Liability</h2>
<h3>{{STUDIO_NAME}}</h3>

<p><strong>Please read this document carefully before signing.</strong></p>

<h4>1. Assumption of Risk</h4>
<p>I understand that dance activities at {{STUDIO_NAME}}, including but not limited to ballet, contemporary, hip-hop, jazz, tap, and other dance forms, involve physical exertion and carry inherent risks of injury. These risks include falls, muscle strains, sprains, fractures, and contact with other participants.</p>

<p>I voluntarily choose to participate in dance classes and activities with full knowledge and acceptance of these risks.</p>

<h4>2. Release of Liability</h4>
<p>I hereby release {{STUDIO_NAME}}, its owners, dance instructors, choreographers, employees, and agents from any and all liability for injury, illness, or damage arising from my participation in dance classes, rehearsals, performances, or any related activities.</p>

<h4>3. Health and Fitness Declaration</h4>
<p>I confirm that:</p>
<ul>
  <li>I am in good physical health and have no medical condition that would prevent safe participation in dance activities</li>
  <li>I will notify my instructor of any injuries, surgeries, or physical limitations before class</li>
  <li>I will stop participating immediately if I experience pain, dizziness, or any unusual symptoms</li>
  <li>I will wear appropriate dance attire and footwear as required for each class</li>
</ul>

<h4>4. Studio Policies</h4>
<p>I agree to:</p>
<ul>
  <li>Follow all instructions from {{STUDIO_NAME}} instructors and staff</li>
  <li>Respect the studio space and equipment</li>
  <li>Not attend class under the influence of alcohol or drugs</li>
  <li>Keep the studio environment professional and supportive for all dancers</li>
</ul>

<h4>5. Performance and Media Consent</h4>
<p>I grant {{STUDIO_NAME}} permission to photograph or record video during classes, rehearsals, and performances for promotional and archival purposes. I understand this may include social media, website, and print materials. I may opt out by providing written notice to the studio.</p>

<h4>6. Minors</h4>
<p>If the participant is a minor (under 18), the parent or legal guardian must sign this waiver on their behalf and assumes all responsibility described herein.</p>

<h4>7. Agreement</h4>
<p>I have read and fully understand this Waiver and Release of Liability. I sign this voluntarily and accept its terms.</p>

<p><strong>This waiver remains in effect for the duration of my enrollment at {{STUDIO_NAME}}.</strong></p>
    `.trim(),
  },
  {
    id: "blank",
    name: "Blank Template",
    description: "Start from scratch with your own custom waiver",
    icon: "📝",
    content: `
<h2>Waiver and Release of Liability</h2>
<h3>{{STUDIO_NAME}}</h3>

<p>[Enter your waiver content here]</p>
    `.trim(),
  },
];
