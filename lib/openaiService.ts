import dotenv from 'dotenv';
dotenv.config();

export const generateRefinedQuestion = async (mergedQuestion: string): Promise<string> => {
  const apiKey = process.env.OPENAI_API_KEY;

  if (!apiKey) {
    throw new Error("Missing OpenAI API key.");
  }

  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${apiKey}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      model: "gpt-4", // You can also use "gpt-3.5-turbo"
      messages: [
        {
          role: "system",
          content: "You are an expert sustainability consultant generating clear and strategic ESG framework questions."
        },
        {
          role: "user",
          content: `Rewrite the following merged question in a more insightful and concise manner:\n\n"${mergedQuestion}"`
        }
      ],
      temperature: 0.7
    })
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error: ${errorText}`);
  }

  const json = await response.json();
  return json.choices[0].message.content.trim();
};
