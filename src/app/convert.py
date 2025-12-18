import csv
import json

# Input CSV file
csv_file = 'questions.csv'

# Output JSON file
json_file = 'questions.json'

# Initialize list to hold all questions
questions_list = []

# Read CSV file
with open(csv_file, newline='') as csvfile:
    reader = csv.DictReader(csvfile)
    for idx, row in enumerate(reader, start=1):
        #print(row)
        question_data = {
            "id": idx,
            "type": "image" if row.get("Image") else "text",
            "subject": row.get("Subject", "").strip(),
            "question": row.get("Question", "").strip(),
            "options": [
                row.get("OptionA", "").strip(),
                row.get("OptionB", "").strip(),
                row.get("OptionC", "").strip(),
                row.get("OptionD", "").strip()
            ],
            "answer": row.get("Answer", "").strip()
        }

        # Include image only if it exists
        if row.get("Image"):
            question_data["image"] = row["Image"].strip()

        questions_list.append(question_data)

# Write JSON file
with open(json_file, 'w', encoding='utf-8') as f:
    json.dump(questions_list, f, indent=4, ensure_ascii=False)

print(f"CSV successfully converted to JSON. Output file: {json_file}")