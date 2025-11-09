# **App Name**: VeriGenius API

## Core Features:

- Student Data Validation: Validates student identity against the university's database.
- Class Assignment: Determines the corresponding class for a validated student based on their level and field of study.
- Secure API Endpoint: Provides a secure POST endpoint (/validate-student) to receive student data for validation, protected by an API key.
- Structured Response: Returns a clear JSON response indicating the success or failure of the validation, including the class ID upon success.
- n8n Integration: The API allows updating student status to 'active' and adding their IDs to the corresponding class document in Firestore, after successful student validation. In case of validation failure, the integration tool notifies administrators for manual intervention.

## Style Guidelines:

- Primary color: Deep blue (#1A237E) to evoke trust and security, aligning with the serious nature of data validation.
- Background color: Light blue (#E3F2FD), a desaturated version of the primary color for a calm and professional feel.
- Accent color: Light purple (#9FA8DA) provides contrast to the primary color without being jarring, emphasizing important actions.
- Body and headline font: 'Inter', a sans-serif font providing a clean, modern and professional look suitable for both headlines and body text.
- Use simple, clear icons to represent different data fields and validation states.
- Maintain a clean and organized layout to ensure easy readability and comprehension of the API responses.