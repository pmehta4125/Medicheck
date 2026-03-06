export function verifyPrescription(fileName) {
  // Fake extracted medicines
  const medicineDB = [
    { name: "Paracetamol", status: "Correct" },
    { name: "Amoxicillin", status: "Mismatch" },
    { name: "Cetirizine", status: "Correct" },
    { name: "Ibuprofen", status: "Wrong" }
  ];

  return {
    prescription: fileName,
    medicines: medicineDB
  };
}
