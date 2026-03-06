import { useMemo, useState } from "react";

const SLOT_KEYS = ["Morning", "Afternoon", "Night"];
const SLOT_TIME = { Morning: "08:00", Afternoon: "14:00", Night: "22:00" };

function inferSlot(dosage = "") {
  const value = dosage.toLowerCase();
  if (value.includes("morning")) return "Morning";
  if (value.includes("afternoon")) return "Afternoon";
  if (value.includes("night") || value.includes("evening")) return "Night";
  return "Morning";
}

export default function Reminders() {
  const extracted = JSON.parse(localStorage.getItem("extractedText")) || [];
  const medicines = extracted[0]?.medicines || [];

  const initialState = useMemo(() => {
    const saved = JSON.parse(localStorage.getItem("medicineReminders")) || {};
    if (Object.keys(saved).length > 0) return saved;

    const generated = {};
    medicines.forEach((med, index) => {
      const slot = inferSlot(med.dosage || "");
      generated[`${med.name}-${index}`] = {
        name: med.name,
        dosage: med.dosage,
        Morning: slot === "Morning",
        Afternoon: slot === "Afternoon",
        Night: slot === "Night",
      };
    });

    return generated;
  }, [medicines]);

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
      localStorage.setItem("medicineReminders", JSON.stringify(next));
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
