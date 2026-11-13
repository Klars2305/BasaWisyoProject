/* ABOUT VIEW */
function viewAbout() {
  return `
    <h2>About BasaWisyo</h2>
    <div class="card">
      <div class="lab">Our Story</div>
      <p class="sub">
        BasaWisyo (a fusion of <i>Basa</i> - to read, and <i>Wisyo</i> - consciousness / wisdom) is a student-led educational innovation developed to tackle the Philippine reading crisis. Many Grade 7 to 12 learners struggle with reading comprehension below their grade level, while overworked teachers handle 40 to 50 students per class with limited internet access.
      </p>
      <p class="sub">
        BasaWisyo bridges this gap by unifying offline Phil-IRI diagnostics, four difficulty tiers of culturally relevant texts, the Wisyo AI Tutor, cooperative Bayanihan quests, and automatic DepEd Form 14 generation into a single lightweight platform.
      </p>
    </div>

    <div class="card">
      <div class="lab">The Founding Team</div>
      <div style="display:flex;flex-direction:column;gap:12px;margin-top:8px">
        <div class="row">
          <div>
            <b>Justin A. Rayon</b>
            <div class="sub-sm">Chief Executive Officer · Strategy & DepEd Partnerships</div>
          </div>
          <span class="pill">Leadership</span>
        </div>
        <div class="row">
          <div>
            <b>Charles Jerico H. Villapa</b>
            <div class="sub-sm">Chief Operating Officer · School Pilots & Teacher Training</div>
          </div>
          <span class="pill">Operations</span>
        </div>
        <div class="row">
          <div>
            <b>Jobert C. Jamelo</b>
            <div class="sub-sm">Chief Technology Officer · Offline Architecture & NLP Systems</div>
          </div>
          <span class="pill">Engineering</span>
        </div>
      </div>
    </div>
  `;
}

