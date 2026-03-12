import { useEffect, useMemo, useState } from "react";
import { getCurrentUserEmail, getActivePrescriptionForCurrentUser } from "../utils/prescription";

const SLOT_KEYS = ["Morning", "Afternoon", "Night"];
const SLOT_TIME = { Morning: "08:00", Afternoon: "14:00", Night: "22:00" };

function inferSlot(frequency = "", dosage = "") {
  const value = `${frequency} ${dosage}`.toLowerCase();
  if (value.includes("tds") || value.includes("thrice")) return ["Morning", "Afternoon", "Night"];
  if (value.includes("bd") || value.includes("twice")) return ["Morning", "Night"];
  if (value.includes("morning")) return ["Morning"];
  if (value.includes("afternoon")) return ["Afternoon"];
  if (value.includes("night") || value.includes("evening") || value.includes("hs") || value.includes("bedtime")) return ["Night"];
  return ["Morning"];
}

function buildRemindersFromMedicines(medicines) {
  const generated = {};
  medicines.forEach((med, index) => {
    const slots = inferSlot(med.frequency || "", med.dosage || "");
    const entry = {
      name: med.name,
      dosage: med.dosage || "Not specified",
      Morning: slots.includes("Morning"),
      Afternoon: slots.includes("Afternoon"),
      Night: slots.includes("Night"),
    };
    generated[`${med.name}-${index}`] = entry;
  });
  return generated;
}

export default function Reminders() {
  const currentEmail = getCurrentUserEmail();
  const activePrescription = getActivePrescriptionForCurrentUser();
  const medicines = activePrescription?.medicines || [];
  const reminderStorageKey = `medicineReminders:${currentEmail || "guest"}`;
  const fingerprintStorageKey = `reminderFingerprint:${currentEmail || "guest"}`;

  // Build a fingerprint of current medicines to detect changes
  const medicineFingerprint = medicines.map((m) => m.name).sort().join(",");

  const initialState = useMemo(() => {
    const saved = JSON.parse(localStorage.getItem(reminderStorageKey)) || {};
    const savedFingerprint = localStorage.getItem(fingerprintStorageKey) || "";

    // If medicines changed, rebuild reminders from scratch
    if (savedFingerprint !== medicineFingerprint || Object.keys(saved).length === 0) {
      const fresh = buildRemindersFromMedicines(medicines);
      localStorage.setItem(reminderStorageKey, JSON.stringify(fresh));
      localStorage.setItem(fingerprintStorageKey, medicineFingerprint);
      return fresh;
    }

    return saved;
  }, [medicines, medicineFingerprint, reminderStorageKey, fingerprintStorageKey]);

  const [reminders, setReminders] = useState(initialState);

  const toggleReminder = (key, slot) => {
    setReminders((prev) => {
      const next = {
        ...prev,
        [key]: {
          ...prev[key],
          [slot]: !prev[key][slot],
        },
      };
      localStorage.setItem(reminderStorageKey, JSON.stringify(next));
      return next;
    });
  };

  const entries = Object.entries(reminders);
  const timeline = entries
    .flatMap(([key, item]) =>
      SLOT_KEYS.filter((slot) => Boolean(item[slot])).map((slot) => ({
        id: `${key}-${slot}`,
        time: SLOT_TIME[slot],
        slot,
        name: item.name,
        dosage: item.dosage || "Not specified",
      }))
    )
    .sort((a, b) => SLOT_KEYS.indexOf(a.slot) - SLOT_KEYS.indexOf(b.slot));

  return (
    <div className="feature-page">
      <h1 className="feature-title">Reminders</h1>
      <p className="feature-subtitle">Toggle medicine reminders for Morning/Afternoon/Night</p>

      <div className="feature-card">
        <h3 className="feature-section-title">Today's Medicine Timeline</h3>
        {timeline.length === 0 ? (
          <p className="feature-row-meta">No active reminder slots yet.</p>
        ) : (
          <div className="timeline-list">
            {timeline.map((item) => (
              <div className="timeline-row-item" key={item.id}>
                <span className="timeline-time-chip">{item.time}</span>
                <span className="timeline-slot-chip">{item.slot}</span>
                <div>
                  <p className="timeline-med-name">{item.name}</p>
                  <p className="schedule-meta">{item.dosage}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {entries.length === 0 ? (
        <div className="feature-card">No medicines available for reminders yet.</div>
      ) : (
        <div className="feature-list">
          {entries.map(([key, item]) => (
            <div className="feature-row" key={key}>
              <div>
                <p className="feature-row-title">{item.name}</p>
                <p className="feature-row-meta">{item.dosage || "Not specified"}</p>
              </div>

              <div className="toggle-group">
                {SLOT_KEYS.map((slot) => (
                  <label key={slot} className="toggle-item">
                    <input
                      type="checkbox"
                      checked={Boolean(item[slot])}
                      onChange={() => toggleReminder(key, slot)}
                    />
                    <span>{slot}</span>
                  </label>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
