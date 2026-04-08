#!/bin/bash

# Define the CSS edits
cat << 'CSS_EOF' >> style.css

/* ======== NEW CALENDAR GRID UI ======== */
.calendar__day {
  padding: 0;
  border: 1px solid rgba(255,255,255,0.03);
  position: relative;
}
.calendar__day:hover {
  background: rgba(206,17,65,0.1);
}
.cal-day-grid {
  display: grid;
  grid-template-columns: 50% 50%;
  grid-template-rows: 40% 60%;
  width: 100%;
  height: 100%;
}
.cd-top-left {
  display: flex;
  align-items: flex-start;
  justify-content: flex-start;
  padding: 4px;
}
.cd-top-right {
  display: flex;
  align-items: flex-start;
  justify-content: flex-end;
  padding: 4px;
}
.cd-bottom-wide {
  grid-column: 1 / span 2;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  padding: 2px;
  gap: 1px;
}
.cd-meal-badge {
  width: 14px;
  height: 14px;
  border-radius: 50%;
  background: rgba(255,215,0,0.15);
  border: 1px solid var(--victory-gold);
  color: var(--victory-gold);
  display: flex;
  align-items: center;
  justify-content: center;
  /* Apple/Google Calendar style dot */
}
.cd-meal-badge svg {
  width: 8px; height: 8px;
}
.cd-train-bar {
  font-size: 8px;
  font-weight: 700;
  line-height: 1;
  padding: 3px 4px;
  border-radius: 3px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: clip;
}
.bg-chest { background: #FF4444; color: white; }
.bg-back { background: #4488FF; color: white; }
.bg-legs { background: #44BB44; color: white; }
.bg-shoulders { background: #FF8800; color: white; }
.bg-arms { background: #AA44FF; color: white; }
.bg-abs { background: #FFD700; color: #1A1A1A; }
.bg-cardio { background: #00CCCC; color: #1A1A1A; }
.bg-rest { background: rgba(255,255,255,0.08); color: #888; border: 1px solid rgba(255,255,255,0.1); }
CSS_EOF

echo "Appended new CSS."

