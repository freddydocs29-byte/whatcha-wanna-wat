export type Meal = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
  ingredients?: string[];
  whyItFits: string;
  image: string;
};

export const meals: Meal[] = [
  // ── Original 8 ────────────────────────────────────────────────────────────
  {
    id: "chicken-alfredo",
    name: "Chicken Alfredo",
    category: "Comfort food",
    description:
      "Creamy, easy, familiar, and feels like a strong low-effort dinner pick.",
    tags: ["25 min", "Kid-friendly", "Easy"],
    ingredients: ["Chicken", "Pasta", "Cheese", "Butter"],
    whyItFits: "Easy win for tonight",
    image:
      "https://images.unsplash.com/photo-1555949258-eb67b1ef0ceb?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tacos",
    name: "Street Tacos",
    category: "Quick & casual",
    description:
      "Fast, customizable, and everyone can build their own. Hard to go wrong.",
    tags: ["20 min", "Crowd pleaser", "Easy"],
    ingredients: ["Ground beef", "Tortillas", "Cheese"],
    whyItFits: "Low stress, high satisfaction",
    image:
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "sushi-bowl",
    name: "Sushi Bowl",
    category: "Fresh",
    description:
      "All the sushi vibes without the rolling. Rice, fish, avocado, done.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Salmon", "Rice"],
    whyItFits: "Fresh and fast when energy is low",
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "burgers",
    name: "Smash Burgers",
    category: "Crowd pleaser",
    description:
      "Crispy edges, juicy center. The kind of burger that earns its reputation.",
    tags: ["30 min", "Grill night", "Indulgent"],
    ingredients: ["Ground beef", "Bread", "Cheese", "Onions"],
    whyItFits: "Treat yourself energy",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pasta-pomodoro",
    name: "Pasta Pomodoro",
    category: "Classic Italian",
    description:
      "Simple tomato sauce, fresh basil, good pasta. Underrated every time.",
    tags: ["20 min", "Pantry staple", "Easy"],
    ingredients: ["Pasta", "Tomatoes", "Garlic", "Onions"],
    whyItFits: "Pantry dinner that punches above its weight",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "thai-curry",
    name: "Thai Green Curry",
    category: "Bold flavors",
    description:
      "Coconut milk, green curry paste, vegetables or chicken. Warming and complex.",
    tags: ["35 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Rice", "Bell peppers"],
    whyItFits: "Hits different when you want something with depth",
    image:
      "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "grain-bowl",
    name: "Grain Bowl",
    category: "Healthy",
    description:
      "Quinoa or farro, roasted veggies, tahini drizzle. Solid and satisfying.",
    tags: ["30 min", "Meal-prep friendly", "Nutritious"],
    ingredients: ["Spinach", "Broccoli", "Mushrooms"],
    whyItFits: "Feel-good choice you won't regret",
    image:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "grilled-salmon",
    name: "Grilled Salmon",
    category: "Elevated",
    description:
      "Lemon, garlic, olive oil. Simple prep, impressive results, 20 minutes.",
    tags: ["20 min", "Protein-packed", "Elegant"],
    ingredients: ["Salmon", "Garlic", "Butter"],
    whyItFits: "Feels fancy without the work",
    image:
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // ── New 17 ─────────────────────────────────────────────────────────────────
  {
    id: "mac-and-cheese",
    name: "Mac & Cheese",
    category: "Comfort food",
    description:
      "Creamy, cheesy, universally loved. The ultimate no-argument weeknight dinner.",
    tags: ["20 min", "Kid-friendly", "Easy"],
    ingredients: ["Pasta", "Cheese", "Butter"],
    whyItFits: "Zero chance of complaints",
    image:
      "https://images.unsplash.com/photo-1543352226-5560a5318e73?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "quesadillas",
    name: "Quesadillas",
    category: "Quick & casual",
    description:
      "Crispy outside, melty inside. Done in 15 minutes with whatever's in the fridge.",
    tags: ["15 min", "Kid-friendly", "Easy"],
    ingredients: ["Tortillas", "Cheese", "Chicken"],
    whyItFits: "Fast, customizable, no debate",
    image:
      "https://images.unsplash.com/photo-1618040996-fb4ac631df46?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "ramen",
    name: "Tonkotsu Ramen",
    category: "Bold flavors",
    description:
      "Rich broth, soft-boiled egg, tender chashu. Comfort in a bowl with real depth.",
    tags: ["30 min", "Flavorful", "Medium effort"],
    ingredients: ["Noodles", "Eggs", "Mushrooms"],
    whyItFits: "Worth every extra minute",
    image:
      "https://images.unsplash.com/photo-1569050483838-ad30f408c1d7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "butter-chicken",
    name: "Butter Chicken",
    category: "Bold flavors",
    description:
      "Silky tomato-cream sauce, tender chicken, warm spices. Best with naan.",
    tags: ["40 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Butter", "Tomatoes", "Garlic"],
    whyItFits: "Big flavor payoff for the effort",
    image:
      "https://images.unsplash.com/photo-1603360013349-33f49fbf73b5?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "shakshuka",
    name: "Shakshuka",
    category: "Mediterranean",
    description:
      "Eggs poached in spiced tomato sauce. One pan, big flavor, deceptively easy.",
    tags: ["25 min", "Vegetarian", "Easy"],
    ingredients: ["Eggs", "Tomatoes", "Onions", "Garlic"],
    whyItFits: "Feels fancy, barely any effort",
    image:
      "https://images.unsplash.com/photo-1591985666643-9ce60217bae8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "poke-bowl",
    name: "Poke Bowl",
    category: "Fresh",
    description:
      "Ahi tuna, rice, avocado, edamame. Fresh and colorful, no cooking required.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Salmon", "Rice"],
    whyItFits: "Clean and satisfying when you want fresh",
    image:
      "https://images.unsplash.com/photo-1546069596-0a240a65c31a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "margherita-pizza",
    name: "Margherita Pizza",
    category: "Classic Italian",
    description:
      "San Marzano tomatoes, fresh mozzarella, basil. Simple and always right.",
    tags: ["25 min", "Kid-friendly", "Crowd pleaser"],
    ingredients: ["Cheese", "Tomatoes", "Garlic"],
    whyItFits: "Crowd pleaser, no exceptions",
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "fried-rice",
    name: "Fried Rice",
    category: "Quick & casual",
    description:
      "Day-old rice, egg, soy, scallions. The best use of leftovers in your fridge.",
    tags: ["20 min", "Easy", "Crowd pleaser"],
    ingredients: ["Rice", "Eggs", "Onions"],
    whyItFits: "Clears the fridge and hits every time",
    image:
      "https://images.unsplash.com/photo-1603133987046-a8a3d37521c4?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "falafel-wrap",
    name: "Falafel Wrap",
    category: "Fresh",
    description:
      "Crispy falafel, hummus, fresh veg, tahini. Light, filling, and plant-based.",
    tags: ["20 min", "Vegetarian", "Light"],
    ingredients: ["Tomatoes", "Garlic", "Bread"],
    whyItFits: "Feels good to eat",
    image:
      "https://images.unsplash.com/photo-1561626423-a51b45aef0a1?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "ribeye-steak",
    name: "Ribeye Steak",
    category: "Elevated",
    description:
      "Butter-basted, cast iron seared. Simple technique, serious result.",
    tags: ["25 min", "Protein-packed", "Grill night"],
    ingredients: ["Steak", "Butter", "Garlic"],
    whyItFits: "When you want to eat like you mean it",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-stir-fry",
    name: "Chicken Stir-Fry",
    category: "Healthy",
    description:
      "Crisp vegetables, tender chicken, savory sauce over steamed rice. Fast and balanced.",
    tags: ["20 min", "Easy", "Light"],
    ingredients: ["Chicken", "Rice", "Bell peppers", "Broccoli"],
    whyItFits: "Fast, healthy, no excuses",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "mushroom-risotto",
    name: "Mushroom Risotto",
    category: "Elevated",
    description:
      "Arborio rice, white wine, parmesan, mixed mushrooms. Rich and deeply savory.",
    tags: ["40 min", "Medium effort", "Elegant"],
    ingredients: ["Rice", "Mushrooms", "Butter", "Cheese"],
    whyItFits: "Worth every stir when the mood is right",
    image:
      "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "lamb-chops",
    name: "Lamb Chops",
    category: "Elevated",
    description:
      "Herb-marinated, pan-seared lamb. Restaurant feel at home, manageable effort.",
    tags: ["30 min", "Protein-packed", "Elegant"],
    ingredients: ["Garlic", "Butter"],
    whyItFits: "Elevated but doable on a weeknight",
    image:
      "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chili",
    name: "Classic Chili",
    category: "Comfort food",
    description:
      "Beef, beans, tomatoes, chili powder. Set it going and it gets better by the hour.",
    tags: ["45 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Ground beef", "Beans", "Tomatoes", "Onions"],
    whyItFits: "Set it, forget it, feed everyone",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "veggie-curry",
    name: "Vegetable Curry",
    category: "Bold flavors",
    description:
      "Chickpeas, cauliflower, coconut milk, warming spices. Hearty and plant-based.",
    tags: ["30 min", "Vegetarian", "Flavorful"],
    ingredients: ["Beans", "Tomatoes", "Spinach"],
    whyItFits: "Satisfying without the meat",
    image:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "caesar-salad",
    name: "Chicken Caesar",
    category: "Healthy",
    description:
      "Grilled chicken, romaine, parmesan, classic dressing. Light enough to not feel guilty.",
    tags: ["15 min", "Easy", "Light"],
    ingredients: ["Chicken", "Cheese"],
    whyItFits: "Light enough to not feel guilty, filling enough to matter",
    image:
      "https://images.unsplash.com/photo-1512852595523-54e2f8d8e9e7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "bbq-chicken",
    name: "BBQ Chicken",
    category: "Crowd pleaser",
    description:
      "Smoky, saucy, falling off the bone. Works every time for every kind of crowd.",
    tags: ["35 min", "Crowd pleaser", "Grill night"],
    ingredients: ["Chicken", "Garlic", "Onions"],
    whyItFits: "Hard to argue with BBQ chicken",
    image:
      "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // ── Expansion 75 ───────────────────────────────────────────────────────────

  // Quick & Casual
  {
    id: "breakfast-burrito",
    name: "Breakfast Burrito",
    category: "Quick & casual",
    description:
      "Scrambled eggs, cheese, and sausage wrapped tight in a warm tortilla. Portable and satisfying any time of day.",
    tags: ["15 min", "Kid-friendly", "Easy"],
    ingredients: ["Eggs", "Tortillas", "Cheese", "Sausage"],
    whyItFits: "Quick protein hit you can eat on the go",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "avocado-toast",
    name: "Avocado Toast",
    category: "Quick & casual",
    description:
      "Smashed avocado on toasted bread with a fried egg and chili flakes. Trendy for a reason.",
    tags: ["15 min", "Vegetarian", "Light"],
    ingredients: ["Bread", "Eggs", "Tomatoes"],
    whyItFits: "Effortless and actually filling",
    image:
      "https://images.unsplash.com/photo-1541519481-1af5bde5b1d2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "grilled-cheese",
    name: "Grilled Cheese",
    category: "Quick & casual",
    description:
      "Buttery, golden, melty. The sandwich that has never let anyone down.",
    tags: ["15 min", "Kid-friendly", "Easy"],
    ingredients: ["Bread", "Cheese", "Butter"],
    whyItFits: "Simple comfort that always works",
    image:
      "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-wrap",
    name: "Chicken Wrap",
    category: "Quick & casual",
    description:
      "Sliced chicken, crisp romaine, cheddar, and ranch in a flour tortilla. Fast lunch energy.",
    tags: ["15 min", "Protein-packed", "Easy"],
    ingredients: ["Chicken", "Tortillas", "Cheese"],
    whyItFits: "Grab-and-go that actually fills you up",
    image:
      "https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "scrambled-eggs",
    name: "Scrambled Eggs & Toast",
    category: "Quick & casual",
    description:
      "Soft, buttery eggs on toasted bread. The breakfast that works for every meal of the day.",
    tags: ["15 min", "Easy", "Pantry staple"],
    ingredients: ["Eggs", "Bread", "Butter"],
    whyItFits: "Zero effort, always hits",
    image:
      "https://images.unsplash.com/photo-1494548162494-384bba4ab999?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "nachos",
    name: "Loaded Nachos",
    category: "Quick & casual",
    description:
      "Tortilla chips layered with melted cheese, beans, jalapeños, and salsa. Built for sharing.",
    tags: ["20 min", "Kid-friendly", "Crowd pleaser"],
    ingredients: ["Cheese", "Beans", "Tomatoes", "Onions"],
    whyItFits: "Crowd food that never disappoints",
    image:
      "https://images.unsplash.com/photo-1513456852971-30c0b8199d4d?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "french-toast",
    name: "French Toast",
    category: "Quick & casual",
    description:
      "Thick-cut bread soaked in egg custard, pan-fried until golden. Weekend breakfast upgrade.",
    tags: ["20 min", "Kid-friendly", "Easy"],
    ingredients: ["Bread", "Eggs", "Butter"],
    whyItFits: "Feels like a treat without trying hard",
    image:
      "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pancakes",
    name: "Pancakes",
    category: "Quick & casual",
    description:
      "Fluffy, golden, stacked tall. The one breakfast everyone can agree on.",
    tags: ["20 min", "Kid-friendly", "Crowd pleaser"],
    ingredients: ["Eggs", "Butter"],
    whyItFits: "The breakfast that brings everyone to the table",
    image:
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "veggie-wrap",
    name: "Veggie Hummus Wrap",
    category: "Quick & casual",
    description:
      "Hummus, roasted peppers, spinach, and feta in a whole wheat wrap. Fresh and filling.",
    tags: ["15 min", "Vegetarian", "Light"],
    ingredients: ["Tortillas", "Spinach", "Bell peppers"],
    whyItFits: "Light, fast, and genuinely satisfying",
    image:
      "https://images.unsplash.com/photo-1540420773420-3366772f4999?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "hot-dogs",
    name: "Classic Hot Dogs",
    category: "Quick & casual",
    description:
      "Grilled sausage in a toasted bun with your choice of toppings. The original quick win.",
    tags: ["15 min", "Kid-friendly", "Easy"],
    ingredients: ["Sausage", "Bread", "Onions"],
    whyItFits: "No one has ever complained about hot dogs",
    image:
      "https://images.unsplash.com/photo-1612392062631-94440b33ef54?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "bacon-egg-cheese",
    name: "Bacon Egg & Cheese",
    category: "Quick & casual",
    description:
      "Crispy bacon, fried egg, melted cheese on a toasted roll. Classic diner energy at home.",
    tags: ["15 min", "Easy", "Protein-packed"],
    ingredients: ["Bacon", "Eggs", "Cheese", "Bread"],
    whyItFits: "The breakfast sandwich that built a city",
    image:
      "https://images.unsplash.com/photo-1550317138-10000687a72b?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tuna-melt",
    name: "Tuna Melt",
    category: "Quick & casual",
    description:
      "Tuna salad, melted cheese, crispy toasted bread. A diner classic made at home in minutes.",
    tags: ["15 min", "Easy", "Pantry staple"],
    ingredients: ["Bread", "Cheese"],
    whyItFits: "Pantry-perfect when you need something fast",
    image:
      "https://images.unsplash.com/photo-1553979459-d2229ba7433a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "loaded-fries",
    name: "Loaded Fries",
    category: "Quick & casual",
    description:
      "Crispy fries topped with melted cheese, bacon bits, and chives. The ultimate snack dinner.",
    tags: ["25 min", "Indulgent", "Crowd pleaser"],
    ingredients: ["Potatoes", "Cheese", "Bacon"],
    whyItFits: "Snack energy that crosses into full meal territory",
    image:
      "https://images.unsplash.com/photo-1573080496219-bb080dd4f877?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Comfort food
  {
    id: "beef-stew",
    name: "Beef Stew",
    category: "Comfort food",
    description:
      "Slow-simmered beef, potatoes, and carrots in rich broth. Cold-weather food done right.",
    tags: ["45 min", "Meal-prep friendly", "Medium effort"],
    ingredients: ["Steak", "Potatoes", "Onions", "Garlic"],
    whyItFits: "The kind of meal that fixes a rough day",
    image:
      "https://images.unsplash.com/photo-1583835746434-cf1534674b41?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-pot-pie",
    name: "Chicken Pot Pie",
    category: "Comfort food",
    description:
      "Flaky crust over creamy chicken and vegetable filling. Pure nostalgia in a dish.",
    tags: ["45 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Chicken", "Potatoes", "Onions", "Butter"],
    whyItFits: "Sunday dinner that feels like a hug",
    image:
      "https://images.unsplash.com/photo-1583845112203-29329902332e?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "meatloaf",
    name: "Classic Meatloaf",
    category: "Comfort food",
    description:
      "Glazed ground beef loaf with mashed potatoes. The weeknight dinner of champions.",
    tags: ["45 min", "Kid-friendly", "Medium effort"],
    ingredients: ["Ground beef", "Onions", "Garlic", "Eggs"],
    whyItFits: "The dinner everyone secretly loves",
    image:
      "https://images.unsplash.com/photo-1607116667981-ff148b3a63de?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-noodle-soup",
    name: "Chicken Noodle Soup",
    category: "Comfort food",
    description:
      "Tender chicken, noodles, celery, and carrots in clear broth. The universal fix.",
    tags: ["35 min", "Easy", "Nutritious"],
    ingredients: ["Chicken", "Noodles", "Onions", "Garlic"],
    whyItFits: "Fixes everything. Scientifically proven.",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "loaded-baked-potato",
    name: "Loaded Baked Potato",
    category: "Comfort food",
    description:
      "Fluffy potato loaded with cheese, sour cream, bacon, and chives. A full meal on its own.",
    tags: ["40 min", "Kid-friendly", "Easy"],
    ingredients: ["Potatoes", "Cheese", "Bacon", "Butter"],
    whyItFits: "Comfort food in its simplest, most satisfying form",
    image:
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "spaghetti-bolognese",
    name: "Spaghetti Bolognese",
    category: "Comfort food",
    description:
      "Slow-cooked meat sauce over spaghetti. The Italian Sunday dinner that became a weeknight staple.",
    tags: ["40 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Ground beef", "Pasta", "Tomatoes", "Garlic"],
    whyItFits: "The sauce gets better the longer you let it go",
    image:
      "https://images.unsplash.com/photo-1598866593549-d8e0d60a3d37?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "potato-soup",
    name: "Creamy Potato Soup",
    category: "Comfort food",
    description:
      "Silky potato soup with bacon, cheddar, and chives. Simple to make, impossible to stop eating.",
    tags: ["30 min", "Easy", "Indulgent"],
    ingredients: ["Potatoes", "Bacon", "Cheese", "Onions"],
    whyItFits: "Warm, filling, and needs nothing else",
    image:
      "https://images.unsplash.com/photo-1547592579-9f20d5a5a5f3?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "french-onion-soup",
    name: "French Onion Soup",
    category: "Comfort food",
    description:
      "Caramelized onions in rich broth, topped with a crouton and melted Gruyère. Patience rewarded.",
    tags: ["45 min", "Elegant", "Medium effort"],
    ingredients: ["Onions", "Butter", "Cheese", "Bread"],
    whyItFits: "Worth every minute of the caramelizing",
    image:
      "https://images.unsplash.com/photo-1602743932936-1e4ee0b7419b?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "shepherds-pie",
    name: "Shepherd's Pie",
    category: "Comfort food",
    description:
      "Seasoned ground beef, peas, and carrots under a buttery mash. Stick-to-your-ribs comfort.",
    tags: ["45 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Ground beef", "Potatoes", "Onions", "Butter"],
    whyItFits: "One dish that feeds everyone and satisfies completely",
    image:
      "https://images.unsplash.com/photo-1574673093985-59c47f1d64b5?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-casserole",
    name: "Chicken Rice Casserole",
    category: "Comfort food",
    description:
      "Chicken, rice, and mushrooms baked together in a creamy sauce. One pan, done deal.",
    tags: ["40 min", "Meal-prep friendly", "Easy"],
    ingredients: ["Chicken", "Rice", "Mushrooms", "Onions"],
    whyItFits: "One pan, no fuss, feeds the whole table",
    image:
      "https://images.unsplash.com/photo-1601972599720-36938d4ecd31?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Bold flavors
  {
    id: "korean-bbq-bowl",
    name: "Korean BBQ Bowl",
    category: "Bold flavors",
    description:
      "Marinated bulgogi beef, sticky rice, pickled vegetables, and sesame. Layered and deeply satisfying.",
    tags: ["30 min", "Flavorful", "Medium effort"],
    ingredients: ["Ground beef", "Rice", "Garlic", "Onions"],
    whyItFits: "When you want big flavors and a full bowl",
    image:
      "https://images.unsplash.com/photo-1583847268964-9d5f6e35d048?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tikka-masala",
    name: "Chicken Tikka Masala",
    category: "Bold flavors",
    description:
      "Charred chicken in a creamy spiced tomato sauce. The Indian dish the whole world can't get enough of.",
    tags: ["40 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Tomatoes", "Garlic", "Butter"],
    whyItFits: "Crowd-pleasing bold flavor that never gets old",
    image:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pad-thai",
    name: "Pad Thai",
    category: "Bold flavors",
    description:
      "Rice noodles, shrimp, eggs, peanuts, and tamarind. The dish that got you into Thai food.",
    tags: ["25 min", "Flavorful", "Medium effort"],
    ingredients: ["Noodles", "Shrimp", "Eggs", "Garlic"],
    whyItFits: "The noodle dish that started your Thai food phase",
    image:
      "https://images.unsplash.com/photo-1559314045-0c04de3ebfce?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "kung-pao-chicken",
    name: "Kung Pao Chicken",
    category: "Bold flavors",
    description:
      "Diced chicken, peanuts, dried chilies, and Sichuan peppercorns. Numbing heat with serious depth.",
    tags: ["25 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Bell peppers", "Garlic", "Onions"],
    whyItFits: "Hits the spice craving and then some",
    image:
      "https://images.unsplash.com/photo-1562802378-9f64e2b21cb2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "jerk-chicken",
    name: "Jerk Chicken",
    category: "Bold flavors",
    description:
      "Scotch bonnet marinade, allspice, and thyme — char-grilled. Caribbean heat you won't forget.",
    tags: ["35 min", "Flavorful", "Grill night"],
    ingredients: ["Chicken", "Garlic", "Onions"],
    whyItFits: "Bold, smoky, and unlike anything else",
    image:
      "https://images.unsplash.com/photo-1501200291289-c5a76c232e5f?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "bibimbap",
    name: "Bibimbap",
    category: "Bold flavors",
    description:
      "Rice topped with seasoned vegetables, beef, a runny egg, and gochujang. Mix it all together.",
    tags: ["30 min", "Nutritious", "Medium effort"],
    ingredients: ["Rice", "Ground beef", "Eggs", "Spinach"],
    whyItFits: "Every bite is a little different",
    image:
      "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "dan-dan-noodles",
    name: "Dan Dan Noodles",
    category: "Bold flavors",
    description:
      "Wheat noodles in chili oil sauce with seasoned pork and scallions. Numbingly good.",
    tags: ["25 min", "Flavorful", "Medium effort"],
    ingredients: ["Noodles", "Ground beef", "Garlic", "Onions"],
    whyItFits: "For when you want heat that slowly builds",
    image:
      "https://images.unsplash.com/photo-1583599872387-a1c73d5c08c8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "mango-curry",
    name: "Mango Chicken Curry",
    category: "Bold flavors",
    description:
      "Sweet mango, spiced coconut milk, and tender chicken. Tropical and warming at once.",
    tags: ["35 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Garlic", "Onions"],
    whyItFits: "The curry that surprises you with sweetness",
    image:
      "https://images.unsplash.com/photo-1565299584077-ea0a3dd34f8a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "spicy-miso-ramen",
    name: "Spicy Miso Ramen",
    category: "Bold flavors",
    description:
      "Miso broth loaded with chili oil, corn, mushrooms, and ramen noodles. Warmth in a bowl.",
    tags: ["30 min", "Flavorful", "Easy"],
    ingredients: ["Noodles", "Mushrooms", "Garlic", "Spinach"],
    whyItFits: "Different enough from tonkotsu to feel completely fresh",
    image:
      "https://images.unsplash.com/photo-1557126819-f3a53d6f9a7d?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "peri-peri-chicken",
    name: "Peri Peri Chicken",
    category: "Bold flavors",
    description:
      "Portuguese-style flame-grilled chicken in spicy peri-peri sauce. Bright, fiery, and addictive.",
    tags: ["35 min", "Flavorful", "Grill night"],
    ingredients: ["Chicken", "Garlic", "Bell peppers"],
    whyItFits: "The flavor is impossible to ignore",
    image:
      "https://images.unsplash.com/photo-1598514536338-8b399a0780f9?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Healthy
  {
    id: "teriyaki-salmon",
    name: "Teriyaki Salmon Bowl",
    category: "Healthy",
    description:
      "Glazed salmon over brown rice with steamed broccoli and edamame. Clean, fast, satisfying.",
    tags: ["20 min", "Protein-packed", "Nutritious"],
    ingredients: ["Salmon", "Rice", "Broccoli"],
    whyItFits: "High-protein clean eating that doesn't feel like a sacrifice",
    image:
      "https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "lettuce-wrap-bowls",
    name: "Lettuce Wrap Bowls",
    category: "Healthy",
    description:
      "Seasoned ground meat in crisp butter lettuce cups with garlic and ginger. Low-carb and fresh.",
    tags: ["20 min", "Light", "Easy"],
    ingredients: ["Ground beef", "Garlic", "Onions"],
    whyItFits: "Filling without the heaviness",
    image:
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "shrimp-stir-fry",
    name: "Shrimp Stir-Fry",
    category: "Healthy",
    description:
      "Tender shrimp, snap peas, bell peppers, and garlic sauce over steamed rice. Fast and high-protein.",
    tags: ["20 min", "Protein-packed", "Easy"],
    ingredients: ["Shrimp", "Bell peppers", "Garlic", "Rice"],
    whyItFits: "Protein-packed and genuinely fast",
    image:
      "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "lentil-soup",
    name: "Lentil Soup",
    category: "Healthy",
    description:
      "Red lentils, cumin, tomatoes, and lemon. Hearty plant-based protein that surprises every time.",
    tags: ["30 min", "Vegetarian", "Nutritious"],
    ingredients: ["Tomatoes", "Garlic", "Onions", "Spinach"],
    whyItFits: "Filling, healthy, and better than you think",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "buddha-bowl",
    name: "Buddha Bowl",
    category: "Healthy",
    description:
      "Roasted chickpeas, kale, quinoa, cucumber, and tahini drizzle. Nourishing and colorful.",
    tags: ["30 min", "Vegetarian", "Nutritious"],
    ingredients: ["Beans", "Spinach", "Tomatoes"],
    whyItFits: "The kind of food that makes you feel like you're winning",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "veggie-omelette",
    name: "Veggie Omelette",
    category: "Healthy",
    description:
      "Fluffy eggs, sautéed peppers, spinach, and feta. Light enough for any meal of the day.",
    tags: ["15 min", "Easy", "Protein-packed"],
    ingredients: ["Eggs", "Bell peppers", "Spinach", "Cheese"],
    whyItFits: "Quick protein that keeps you going all day",
    image:
      "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "stuffed-peppers",
    name: "Stuffed Bell Peppers",
    category: "Healthy",
    description:
      "Bell peppers filled with seasoned rice, ground beef, and tomato sauce. Complete and colorful.",
    tags: ["40 min", "Meal-prep friendly", "Medium effort"],
    ingredients: ["Bell peppers", "Ground beef", "Rice", "Tomatoes"],
    whyItFits: "Built-in portion control that actually tastes great",
    image:
      "https://images.unsplash.com/photo-1513135467880-6c41603eb5e5?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "baked-lemon-chicken",
    name: "Baked Lemon Herb Chicken",
    category: "Healthy",
    description:
      "Chicken thighs roasted with lemon, garlic, and herbs. Reliable, clean, and satisfying.",
    tags: ["35 min", "Easy", "Protein-packed"],
    ingredients: ["Chicken", "Garlic", "Butter"],
    whyItFits: "Clean eating that doesn't feel like a compromise",
    image:
      "https://images.unsplash.com/photo-1598103442097-8b74394b95c8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tuna-salad",
    name: "Tuna Salad Plate",
    category: "Healthy",
    description:
      "Classic tuna salad over mixed greens with tomatoes and cucumber. No-cook protein that keeps.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Tomatoes", "Onions"],
    whyItFits: "Fast, no-fuss, and lighter than you'd expect",
    image:
      "https://images.unsplash.com/photo-1512852595523-54e2f8d8e9e7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "black-bean-bowl",
    name: "Black Bean Bowl",
    category: "Healthy",
    description:
      "Seasoned black beans, rice, shredded cabbage, corn, and lime. Simple, filling, and vegetarian.",
    tags: ["20 min", "Vegetarian", "Meal-prep friendly"],
    ingredients: ["Beans", "Rice", "Tomatoes", "Onions"],
    whyItFits: "Plant-based meal that actually fills you up",
    image:
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Elevated
  {
    id: "coq-au-vin",
    name: "Coq au Vin",
    category: "Elevated",
    description:
      "Chicken braised in red wine with mushrooms, pearl onions, and bacon. French bistro at home.",
    tags: ["45 min", "Elegant", "Medium effort"],
    ingredients: ["Chicken", "Mushrooms", "Bacon", "Onions"],
    whyItFits: "Dinner party energy on a Tuesday",
    image:
      "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "sea-bass",
    name: "Pan-Seared Sea Bass",
    category: "Elevated",
    description:
      "Crispy-skinned sea bass with capers, lemon butter, and wilted spinach. Elegant and light.",
    tags: ["25 min", "Elegant", "Protein-packed"],
    ingredients: ["Butter", "Garlic", "Spinach"],
    whyItFits: "Restaurant plate you made yourself",
    image:
      "https://images.unsplash.com/photo-1519984388953-d2406bc725e1?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "duck-breast",
    name: "Duck Breast",
    category: "Elevated",
    description:
      "Score, sear, rest. Crispy skin, rosy interior, served with a cherry reduction.",
    tags: ["30 min", "Elegant", "Medium effort"],
    ingredients: ["Garlic", "Butter"],
    whyItFits: "Impressive result from a method anyone can master",
    image:
      "https://images.unsplash.com/photo-1518492104633-130d0cc84637?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "beef-tenderloin",
    name: "Beef Tenderloin",
    category: "Elevated",
    description:
      "Perfectly seared center-cut tenderloin with herb butter. The special occasion steak.",
    tags: ["25 min", "Elegant", "Protein-packed"],
    ingredients: ["Steak", "Butter", "Garlic"],
    whyItFits: "When the occasion calls for the best",
    image:
      "https://images.unsplash.com/photo-1558030137-a56c1b003f91?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "seared-scallops",
    name: "Seared Scallops",
    category: "Elevated",
    description:
      "Golden crust, translucent center, finished with brown butter and capers. Elegant simplicity.",
    tags: ["15 min", "Elegant", "Easy"],
    ingredients: ["Butter", "Garlic"],
    whyItFits: "The easiest impressive dinner you can make",
    image:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "stuffed-mushrooms",
    name: "Stuffed Portobello Mushrooms",
    category: "Elevated",
    description:
      "Large portobellos filled with spinach, sun-dried tomatoes, and goat cheese. Elegant and vegetarian.",
    tags: ["25 min", "Vegetarian", "Elegant"],
    ingredients: ["Mushrooms", "Spinach", "Cheese", "Garlic"],
    whyItFits: "Vegetarian centerpiece that doesn't feel like a compromise",
    image:
      "https://images.unsplash.com/photo-1506280754576-f6fa8a873550?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Classic Italian
  {
    id: "carbonara",
    name: "Pasta Carbonara",
    category: "Classic Italian",
    description:
      "Spaghetti, guanciale, egg yolks, and pecorino. No cream needed. The Roman way.",
    tags: ["20 min", "Indulgent", "Medium effort"],
    ingredients: ["Pasta", "Eggs", "Cheese", "Bacon"],
    whyItFits: "Proper Italian comfort in 20 minutes",
    image:
      "https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "beef-lasagna",
    name: "Beef Lasagna",
    category: "Classic Italian",
    description:
      "Layers of pasta, bolognese, béchamel, and parmesan. The Sunday project that feeds everyone.",
    tags: ["45 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Ground beef", "Pasta", "Cheese", "Tomatoes"],
    whyItFits: "When you want to cook something that actually matters",
    image:
      "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-piccata",
    name: "Chicken Piccata",
    category: "Classic Italian",
    description:
      "Thin chicken cutlets in lemon-caper butter sauce. Light, tangy, and restaurant-quality fast.",
    tags: ["20 min", "Elegant", "Easy"],
    ingredients: ["Chicken", "Butter", "Garlic"],
    whyItFits: "Italian technique that's easier than it looks",
    image:
      "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "gnocchi",
    name: "Gnocchi with Brown Butter",
    category: "Classic Italian",
    description:
      "Pillowy potato gnocchi in sage brown butter with parmesan. Rich and comforting.",
    tags: ["25 min", "Indulgent", "Easy"],
    ingredients: ["Potatoes", "Butter", "Cheese"],
    whyItFits: "Feels like restaurant pasta without the restaurant bill",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "penne-arrabbiata",
    name: "Penne Arrabbiata",
    category: "Classic Italian",
    description:
      "Penne in a fiery tomato-garlic sauce. Simple, spicy, and satisfying.",
    tags: ["20 min", "Flavorful", "Easy"],
    ingredients: ["Pasta", "Tomatoes", "Garlic"],
    whyItFits: "Quick pasta that has actual personality",
    image:
      "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "bruschetta",
    name: "Bruschetta al Pomodoro",
    category: "Classic Italian",
    description:
      "Toasted bread, fresh tomatoes, basil, garlic, and good olive oil. Better than it has any right to be.",
    tags: ["15 min", "Vegetarian", "Easy"],
    ingredients: ["Bread", "Tomatoes", "Garlic"],
    whyItFits: "The starter that somehow steals the show",
    image:
      "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Mediterranean
  {
    id: "greek-salad",
    name: "Greek Salad",
    category: "Mediterranean",
    description:
      "Tomatoes, cucumber, olives, feta, and red onion with oregano. The salad that tastes like a vacation.",
    tags: ["15 min", "Vegetarian", "No-cook option"],
    ingredients: ["Tomatoes", "Onions", "Cheese"],
    whyItFits: "Bright, fresh, and zero cooking required",
    image:
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "hummus-plate",
    name: "Hummus Plate",
    category: "Mediterranean",
    description:
      "Silky hummus, warm pita, olives, and crudités. The snack meal that becomes dinner.",
    tags: ["15 min", "Vegetarian", "No-cook option"],
    ingredients: ["Beans", "Garlic", "Bread"],
    whyItFits: "Deceptively simple and genuinely satisfying",
    image:
      "https://images.unsplash.com/photo-1577906071869-7c74a8ebd15?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "moussaka",
    name: "Moussaka",
    category: "Mediterranean",
    description:
      "Layered eggplant, spiced ground beef, and béchamel. Greek comfort food at its most indulgent.",
    tags: ["45 min", "Indulgent", "Medium effort"],
    ingredients: ["Ground beef", "Onions", "Garlic", "Tomatoes"],
    whyItFits: "Takes time and is worth every minute",
    image:
      "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tabbouleh",
    name: "Tabbouleh",
    category: "Mediterranean",
    description:
      "Bulgur wheat, parsley, mint, tomatoes, and lemon. Light and herbaceous, a perfect standalone.",
    tags: ["15 min", "Vegetarian", "Light"],
    ingredients: ["Tomatoes", "Onions"],
    whyItFits: "Refreshing and clean without trying to be",
    image:
      "https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-souvlaki",
    name: "Chicken Souvlaki",
    category: "Mediterranean",
    description:
      "Grilled chicken skewers with lemon, oregano, tzatziki, and warm pita. Greek street food at home.",
    tags: ["30 min", "Protein-packed", "Grill night"],
    ingredients: ["Chicken", "Garlic", "Bread"],
    whyItFits: "The Greek takeout you can make better at home",
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "spanish-tortilla",
    name: "Spanish Tortilla",
    category: "Mediterranean",
    description:
      "Thick egg and potato omelette, golden on the outside and custardy within. Spanish simplicity.",
    tags: ["25 min", "Vegetarian", "Easy"],
    ingredients: ["Eggs", "Potatoes", "Onions"],
    whyItFits: "The Spanish staple you'll want to make every week",
    image:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Fresh
  {
    id: "vietnamese-spring-rolls",
    name: "Vietnamese Spring Rolls",
    category: "Fresh",
    description:
      "Rice paper rolls with shrimp, vermicelli, herbs, and peanut sauce. Light and addictive.",
    tags: ["20 min", "No-cook option", "Light"],
    ingredients: ["Shrimp", "Noodles"],
    whyItFits: "Light, fresh, and fun to assemble",
    image:
      "https://images.unsplash.com/photo-1562802378-9f64e2b21cb2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "shrimp-ceviche",
    name: "Shrimp Ceviche",
    category: "Fresh",
    description:
      "Shrimp cured in lime juice with tomatoes, cilantro, and avocado. Bright and completely refreshing.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Shrimp", "Tomatoes", "Onions"],
    whyItFits: "Bright, clean, no stove required",
    image:
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "caprese-salad",
    name: "Caprese Salad",
    category: "Fresh",
    description:
      "Ripe tomatoes, fresh mozzarella, basil, and olive oil. Italian summer in three ingredients.",
    tags: ["15 min", "Vegetarian", "No-cook option"],
    ingredients: ["Tomatoes", "Cheese"],
    whyItFits: "Three good ingredients and no cooking needed",
    image:
      "https://images.unsplash.com/photo-1592417817098-8fd3d9eb14a5?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "cold-sesame-noodles",
    name: "Cold Sesame Noodles",
    category: "Fresh",
    description:
      "Noodles in sesame-peanut sauce, cucumber, scallions, and chili oil. Room temperature and deeply savory.",
    tags: ["15 min", "Vegetarian", "Easy"],
    ingredients: ["Noodles", "Garlic", "Spinach"],
    whyItFits: "The noodle dish that's better cold",
    image:
      "https://images.unsplash.com/photo-1569050483838-ad30f408c1d7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "mango-shrimp-bowl",
    name: "Mango Shrimp Bowl",
    category: "Fresh",
    description:
      "Grilled shrimp, fresh mango, rice, and lime crema. Tropical bowl energy in 20 minutes.",
    tags: ["20 min", "Light", "Easy"],
    ingredients: ["Shrimp", "Rice"],
    whyItFits: "Bright and tropical when you need a lift",
    image:
      "https://images.unsplash.com/photo-1546069596-0a240a65c31a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "nicoise-salad",
    name: "Niçoise Salad",
    category: "Fresh",
    description:
      "Green beans, potatoes, olives, hard-boiled eggs, and a mustardy vinaigrette. The French composed salad.",
    tags: ["25 min", "Nutritious", "Easy"],
    ingredients: ["Eggs", "Potatoes", "Tomatoes"],
    whyItFits: "A complete meal that somehow feels refined",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Crowd pleaser
  {
    id: "pulled-pork-sandwich",
    name: "Pulled Pork Sandwich",
    category: "Crowd pleaser",
    description:
      "Slow-cooked pulled pork, tangy BBQ sauce, and coleslaw on a brioche bun. Nobody walks away unhappy.",
    tags: ["45 min", "Indulgent", "Crowd pleaser"],
    ingredients: ["Bread", "Onions", "Garlic"],
    whyItFits: "Nobody walks away from pulled pork unhappy",
    image:
      "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-wings",
    name: "Chicken Wings",
    category: "Crowd pleaser",
    description:
      "Crispy wings in buffalo or honey garlic sauce. The universal crowd pleaser that disappears instantly.",
    tags: ["35 min", "Crowd pleaser", "Indulgent"],
    ingredients: ["Chicken", "Butter", "Garlic"],
    whyItFits: "Never fails to disappear before you've had enough",
    image:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "fish-tacos",
    name: "Fish Tacos",
    category: "Crowd pleaser",
    description:
      "Battered fish, crunchy slaw, and chipotle mayo in corn tortillas. Coastal energy wherever you are.",
    tags: ["25 min", "Light", "Easy"],
    ingredients: ["Salmon", "Tortillas", "Onions"],
    whyItFits: "Fresh and crowd-friendly with a coastal vibe",
    image:
      "https://images.unsplash.com/photo-1551504734-5da7e163d3a2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "sloppy-joes",
    name: "Sloppy Joes",
    category: "Crowd pleaser",
    description:
      "Loose ground beef in a tangy tomato sauce on a soft bun. Messy, fun, and universally loved.",
    tags: ["20 min", "Kid-friendly", "Easy"],
    ingredients: ["Ground beef", "Bread", "Tomatoes", "Onions"],
    whyItFits: "Gets everyone at the table immediately",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-tenders",
    name: "Chicken Tenders",
    category: "Crowd pleaser",
    description:
      "Crispy breaded chicken strips with dipping sauces. Kid-approved and adult-enjoyed.",
    tags: ["25 min", "Kid-friendly", "Easy"],
    ingredients: ["Chicken", "Eggs", "Bread"],
    whyItFits: "The universal crowd pleaser that works every single time",
    image:
      "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "breakfast-for-dinner",
    name: "Breakfast for Dinner",
    category: "Crowd pleaser",
    description:
      "Eggs, bacon, pancakes, and toast. When dinner needs to be fun and everyone needs to agree.",
    tags: ["25 min", "Kid-friendly", "Crowd pleaser"],
    ingredients: ["Eggs", "Bacon", "Bread", "Butter"],
    whyItFits: "Dinner that feels like getting away with something",
    image:
      "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "garlic-butter-shrimp",
    name: "Garlic Butter Shrimp",
    category: "Crowd pleaser",
    description:
      "Shrimp sautéed in garlic butter with white wine and parsley. Simple elegance that feeds a crowd.",
    tags: ["15 min", "Easy", "Crowd pleaser"],
    ingredients: ["Shrimp", "Butter", "Garlic"],
    whyItFits: "Fast, impressive, and gone before you know it",
    image:
      "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "steak-frites",
    name: "Steak Frites",
    category: "Crowd pleaser",
    description:
      "Seared steak with crispy hand-cut fries and herb butter. The French brasserie classic.",
    tags: ["30 min", "Indulgent", "Medium effort"],
    ingredients: ["Steak", "Potatoes", "Butter", "Garlic"],
    whyItFits: "The steak dinner that needs nothing else",
    image:
      "https://images.unsplash.com/photo-1558030137-a56c1b003f91?auto=format&fit=crop&w=600&h=750&q=80",
  },
];
