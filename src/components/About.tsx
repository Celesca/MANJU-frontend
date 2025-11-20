export default function About() {
  const cards = [
    { title: "Card 1", description: "This is the first card." },
    { title: "Card 2", description: "This is the second card." },
    { title: "Card 3", description: "This is the third card." },
    { title: "Card 4", description: "This is the fourth card." },
  ];

  return (
    <div className="min-h-screen bg-gradient-to-r from-purple-700 via-indigo-700 to-blue-800 p-6">
      <h1 className="text-4xl font-bold mb-8 text-white text-center">About Us</h1>
      <p className="text-gray-200 mb-12 text-center max-w-xl mx-auto">
        Welcome to our About pa
        ge! Here you can describe your company, project, or yourself.
      </p>

      {/* Grid การ์ด 2x2 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-6 max-w-4xl mx-auto">
        {cards.map((card, index) => (
          <div
            key={index}
            className="bg-white rounded-xl shadow-lg p-6 hover:scale-105 transform transition duration-300"
          >
            <h2 className="text-2xl font-semibold mb-2">{card.title}</h2>
            <p className="text-gray-700">{card.description}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
