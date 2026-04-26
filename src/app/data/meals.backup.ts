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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/chicken-alfredo.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/tacos.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/sushi-bowl.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/burgers.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/pasta-pomodoro.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/thai-curry.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/grain-bowl.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/grilled-salmon.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/mac-and-cheese.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/quesadillas.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/ramen.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/butter-chicken.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/shakshuka.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/poke-bowl.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/margherita-pizza.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/fried-rice.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/falafel-wrap.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/ribeye-steak.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/mushroom-risotto.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/chili.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/caesar-salad.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/bbq-chicken.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/breakfast-burrito.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/avocado-toast.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/grilled-cheese.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/chicken-wrap.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/scrambled-eggs.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/nachos.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/french-toast.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/pancakes.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/hot-dogs.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/bacon-egg-cheese.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/tuna-melt.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/loaded-fries.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/beef-stew.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/chicken-pot-pie.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/meatloaf.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/chicken-noodle-soup.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/loaded-baked-potato.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/spaghetti-bolognese.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/potato-soup.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/shepherds-pie.jpg",
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
      "https://kqbkqyuapwpihqgftncs.supabase.co/storage/v1/object/public/meal-images/chicken-casserole.jpg",
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

  // ── Expansion 100 ──────────────────────────────────────────────────────────

  // Quick & Casual
  {
    id: "blt-sandwich",
    name: "BLT Sandwich",
    category: "Quick & casual",
    description:
      "Crispy bacon, ripe tomatoes, and lettuce stacked on toasted bread. The sandwich that earned its initials.",
    tags: ["15 min", "Kid-friendly", "Easy"],
    ingredients: ["Bacon", "Bread", "Tomatoes"],
    whyItFits: "Classic that never needs an explanation",
    image:
      "https://images.unsplash.com/photo-1553979459-d2229ba7433a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "club-sandwich",
    name: "Club Sandwich",
    category: "Quick & casual",
    description:
      "Triple-decker with chicken, bacon, and tomato on toasted bread. The diner classic that's somehow still underrated.",
    tags: ["20 min", "Easy", "Protein-packed"],
    ingredients: ["Chicken", "Bacon", "Bread", "Tomatoes"],
    whyItFits: "Stacked, satisfying, and always hits",
    image:
      "https://images.unsplash.com/photo-1528736235302-52922df5c122?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "breakfast-hash",
    name: "Breakfast Hash",
    category: "Quick & casual",
    description:
      "Crispy potatoes, bacon, and eggs scrambled together in one pan. The breakfast that doubles as dinner.",
    tags: ["25 min", "Easy", "Kid-friendly"],
    ingredients: ["Potatoes", "Eggs", "Bacon", "Onions"],
    whyItFits: "One pan, zero waste, everyone wins",
    image:
      "https://images.unsplash.com/photo-1525351484163-7529414344d8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "waffles",
    name: "Waffles",
    category: "Quick & casual",
    description:
      "Golden, crispy-edged waffles with maple syrup. The weekend breakfast upgrade from pancakes.",
    tags: ["20 min", "Kid-friendly", "Crowd pleaser"],
    ingredients: ["Eggs", "Butter"],
    whyItFits: "Crispier than pancakes and just as crowd-pleasing",
    image:
      "https://images.unsplash.com/photo-1484723091739-30a097e8f929?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "mini-pizzas",
    name: "English Muffin Pizzas",
    category: "Quick & casual",
    description:
      "Toasted muffins with tomato sauce, mozzarella, and whatever toppings are around. Quick, fun, personal.",
    tags: ["15 min", "Kid-friendly", "Easy"],
    ingredients: ["Bread", "Cheese", "Tomatoes"],
    whyItFits: "Kids build their own, you do nothing",
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "cheesesteak",
    name: "Philly Cheesesteak",
    category: "Quick & casual",
    description:
      "Thin-sliced steak, melted cheese, and sautéed onions in a hoagie roll. The sandwich Philly got right.",
    tags: ["25 min", "Indulgent", "Easy"],
    ingredients: ["Steak", "Bread", "Cheese", "Onions"],
    whyItFits: "All the flavor, none of the travel",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "egg-salad-sandwich",
    name: "Egg Salad Sandwich",
    category: "Quick & casual",
    description:
      "Classic egg salad on toasted bread with a little crunch and celery. The underrated lunch ready in minutes.",
    tags: ["15 min", "Easy", "Pantry staple"],
    ingredients: ["Eggs", "Bread", "Onions"],
    whyItFits: "Pantry ingredients, zero excuses",
    image:
      "https://images.unsplash.com/photo-1494548162494-384bba4ab999?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-salad-wrap",
    name: "Chicken Salad Wrap",
    category: "Quick & casual",
    description:
      "Creamy chicken salad with celery and herbs wrapped in a flour tortilla. Lunch done efficiently.",
    tags: ["15 min", "Easy", "Protein-packed"],
    ingredients: ["Chicken", "Tortillas", "Onions"],
    whyItFits: "Protein in, effort out",
    image:
      "https://images.unsplash.com/photo-1553909489-cd47e0907980?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "bagel-lox",
    name: "Bagel & Lox",
    category: "Quick & casual",
    description:
      "Cream cheese, smoked salmon, capers, and red onion on a toasted bagel. The breakfast worth getting out of bed for.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Bread", "Salmon", "Onions", "Cheese"],
    whyItFits: "No cooking, feels like brunch",
    image:
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "hash-browns",
    name: "Hash Browns & Eggs",
    category: "Quick & casual",
    description:
      "Shredded crispy hash browns alongside fried eggs. The diner breakfast without leaving the house.",
    tags: ["20 min", "Easy", "Kid-friendly"],
    ingredients: ["Potatoes", "Eggs", "Butter"],
    whyItFits: "Crispy, simple, done fast",
    image:
      "https://images.unsplash.com/photo-1567620905732-2d1ec7ab7445?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "miso-rice",
    name: "Miso Soup & Rice Bowl",
    category: "Quick & casual",
    description:
      "Silky miso broth with tofu and scallions over steamed rice. Simple Japanese comfort in under 20 minutes.",
    tags: ["15 min", "Easy", "Light"],
    ingredients: ["Rice", "Mushrooms", "Onions"],
    whyItFits: "Light, warm, and done before you second-guess it",
    image:
      "https://images.unsplash.com/photo-1557126819-f3a53d6f9a7d?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "congee",
    name: "Savory Rice Congee",
    category: "Quick & casual",
    description:
      "Slow-simmered rice porridge topped with soft egg, ginger, and scallions. Asian comfort in a bowl.",
    tags: ["25 min", "Easy", "Nutritious"],
    ingredients: ["Rice", "Garlic", "Onions", "Eggs"],
    whyItFits: "Gentle, filling, and surprisingly satisfying",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pan-fried-gyoza",
    name: "Pan-Fried Gyoza",
    category: "Quick & casual",
    description:
      "Crispy-bottomed, steamed-top dumplings filled with seasoned pork and cabbage. The bite-sized crowd pleaser.",
    tags: ["25 min", "Easy", "Crowd pleaser"],
    ingredients: ["Ground beef", "Garlic", "Onions"],
    whyItFits: "Crispy on one side, tender on the other — hard to stop eating",
    image:
      "https://images.unsplash.com/photo-1562802378-9f64e2b21cb2?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Comfort food
  {
    id: "tomato-soup",
    name: "Creamy Tomato Soup",
    category: "Comfort food",
    description:
      "Rich blended tomato soup with a drizzle of cream and fresh basil. Pairs perfectly with grilled cheese.",
    tags: ["30 min", "Vegetarian", "Easy"],
    ingredients: ["Tomatoes", "Butter", "Garlic", "Onions"],
    whyItFits: "The soup that needs nothing except maybe a grilled cheese",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pot-roast",
    name: "Sunday Pot Roast",
    category: "Comfort food",
    description:
      "Slow-braised beef with potatoes and root vegetables. The Sunday dinner that fills the house with the right smell.",
    tags: ["45 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Steak", "Potatoes", "Onions", "Garlic"],
    whyItFits: "Makes the whole house smell right on a Sunday",
    image:
      "https://images.unsplash.com/photo-1583835746434-cf1534674b41?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-dumplings",
    name: "Chicken & Dumplings",
    category: "Comfort food",
    description:
      "Tender chicken in rich broth with fluffy dumpling pillows on top. Pure Americana comfort.",
    tags: ["45 min", "Kid-friendly", "Medium effort"],
    ingredients: ["Chicken", "Onions", "Garlic", "Butter"],
    whyItFits: "The dumpling pillows land it every time",
    image:
      "https://images.unsplash.com/photo-1601972599720-36938d4ecd31?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "biscuits-gravy",
    name: "Biscuits & Gravy",
    category: "Comfort food",
    description:
      "Flaky buttery biscuits smothered in creamy sausage gravy. Southern breakfast that can become dinner.",
    tags: ["25 min", "Indulgent", "Easy"],
    ingredients: ["Sausage", "Butter", "Onions"],
    whyItFits: "Indulgent in the best possible way",
    image:
      "https://images.unsplash.com/photo-1585747860715-2ba37e788b70?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "beef-vegetable-soup",
    name: "Beef & Vegetable Soup",
    category: "Comfort food",
    description:
      "Chunks of beef with mushrooms, carrots, and celery in a deeply savory broth. Stick-to-your-ribs soup.",
    tags: ["45 min", "Nutritious", "Medium effort"],
    ingredients: ["Steak", "Onions", "Garlic", "Mushrooms"],
    whyItFits: "Gets better the longer you let it simmer",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tuna-noodle",
    name: "Tuna Noodle Casserole",
    category: "Comfort food",
    description:
      "Egg noodles, tuna, cream of mushroom, and cheddar baked to a crispy top. Retro comfort at its finest.",
    tags: ["35 min", "Meal-prep friendly", "Easy"],
    ingredients: ["Noodles", "Mushrooms", "Cheese", "Onions"],
    whyItFits: "Makes a lot, reheats perfectly, no apologies needed",
    image:
      "https://images.unsplash.com/photo-1476124369491-e7addf5db371?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "stuffed-cabbage",
    name: "Stuffed Cabbage Rolls",
    category: "Comfort food",
    description:
      "Ground beef and rice rolls slow-simmered in a sweet tomato sauce. Eastern European comfort at its best.",
    tags: ["45 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Ground beef", "Rice", "Tomatoes", "Onions"],
    whyItFits: "Slow-cooked and deeply satisfying",
    image:
      "https://images.unsplash.com/photo-1583847268964-9d5f6e35d048?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "corn-chowder",
    name: "Corn Chowder",
    category: "Comfort food",
    description:
      "Creamy chowder thick with sweet corn, potato, and bacon. The bowl that says it's okay to stop today.",
    tags: ["30 min", "Indulgent", "Easy"],
    ingredients: ["Potatoes", "Bacon", "Onions", "Butter"],
    whyItFits: "Thick and sweet and exactly what a cold night calls for",
    image:
      "https://images.unsplash.com/photo-1547592579-9f20d5a5a5f3?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "sausage-pasta",
    name: "Sausage & Tomato Pasta",
    category: "Comfort food",
    description:
      "Italian sausage, crushed tomatoes, and pasta in one pan. Fast weeknight dinner with actual depth.",
    tags: ["25 min", "Easy", "Crowd pleaser"],
    ingredients: ["Sausage", "Pasta", "Tomatoes", "Garlic"],
    whyItFits: "Sausage does all the heavy lifting",
    image:
      "https://images.unsplash.com/photo-1598866593549-d8e0d60a3d37?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "broccoli-cheddar-soup",
    name: "Broccoli Cheddar Soup",
    category: "Comfort food",
    description:
      "Thick, velvety broccoli soup with sharp cheddar. Comfort in a bowl secretly loaded with vegetables.",
    tags: ["30 min", "Vegetarian", "Easy"],
    ingredients: ["Broccoli", "Cheese", "Butter", "Onions"],
    whyItFits: "The sneaky vegetable soup that doesn't taste like a sacrifice",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "white-bean-soup",
    name: "White Bean & Sausage Soup",
    category: "Comfort food",
    description:
      "Creamy white beans, Italian sausage, and wilted spinach in herbed broth. Hearty and nearly effortless.",
    tags: ["30 min", "Nutritious", "Easy"],
    ingredients: ["Beans", "Sausage", "Garlic", "Spinach"],
    whyItFits: "Barely any effort for how satisfying it lands",
    image:
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "red-beans-rice",
    name: "Red Beans & Rice",
    category: "Comfort food",
    description:
      "Creole-style kidney beans and andouille over white rice. New Orleans soul food done simply.",
    tags: ["30 min", "Crowd pleaser", "Easy"],
    ingredients: ["Beans", "Rice", "Sausage", "Onions"],
    whyItFits: "New Orleans soul in 30 minutes",
    image:
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Bold flavors
  {
    id: "szechuan-beef",
    name: "Szechuan Beef",
    category: "Bold flavors",
    description:
      "Thinly sliced beef wok-tossed with Sichuan peppercorns, chilies, and garlic. Numbing, fiery, addictive.",
    tags: ["25 min", "Flavorful", "Medium effort"],
    ingredients: ["Steak", "Bell peppers", "Garlic", "Onions"],
    whyItFits: "The heat that creeps up and doesn't let go",
    image:
      "https://images.unsplash.com/photo-1562802378-9f64e2b21cb2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "moroccan-chicken",
    name: "Moroccan Chicken Tagine",
    category: "Bold flavors",
    description:
      "Slow-braised chicken with preserved lemon, olives, and warm Moroccan spices. North African warmth.",
    tags: ["40 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Tomatoes", "Onions", "Garlic"],
    whyItFits: "Spice depth that takes you somewhere completely different",
    image:
      "https://images.unsplash.com/photo-1455619452474-d2be8b1e70cd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "massaman-curry",
    name: "Massaman Curry",
    category: "Bold flavors",
    description:
      "Rich, mild Thai curry with potatoes, peanuts, and coconut milk. Sweet, warm, and deeply comforting.",
    tags: ["40 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Potatoes", "Onions"],
    whyItFits: "Thai curry for people who like flavor without the fire",
    image:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "birria-tacos",
    name: "Birria Tacos",
    category: "Bold flavors",
    description:
      "Beef braised in dried chiles, dipped in consomé, and crisped on the griddle. Instagram-worthy for a reason.",
    tags: ["45 min", "Flavorful", "Medium effort"],
    ingredients: ["Ground beef", "Tortillas", "Onions", "Tomatoes"],
    whyItFits: "The taco that gets everyone talking",
    image:
      "https://images.unsplash.com/photo-1565299585323-38d6b0865b47?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "beef-pho",
    name: "Beef Pho",
    category: "Bold flavors",
    description:
      "Fragrant star anise broth with paper-thin beef, rice noodles, and fresh herbs. Vietnamese warmth in a bowl.",
    tags: ["35 min", "Flavorful", "Medium effort"],
    ingredients: ["Steak", "Noodles", "Onions", "Garlic"],
    whyItFits: "The broth alone is worth making this",
    image:
      "https://images.unsplash.com/photo-1569050483838-ad30f408c1d7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "drunken-noodles",
    name: "Drunken Noodles",
    category: "Bold flavors",
    description:
      "Wide rice noodles stir-fried with basil, chilies, and chicken. Bangkok street food with serious wok heat.",
    tags: ["25 min", "Flavorful", "Easy"],
    ingredients: ["Noodles", "Chicken", "Bell peppers", "Garlic"],
    whyItFits: "Different from Pad Thai in every way that matters",
    image:
      "https://images.unsplash.com/photo-1559314045-0c04de3ebfce?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "harissa-chicken",
    name: "Harissa Roasted Chicken",
    category: "Bold flavors",
    description:
      "Chicken thighs baked in a fiery harissa-tomato sauce with roasted peppers. North African spice done right.",
    tags: ["35 min", "Flavorful", "Grill night"],
    ingredients: ["Chicken", "Garlic", "Tomatoes", "Bell peppers"],
    whyItFits: "Set it in and let the harissa do the work",
    image:
      "https://images.unsplash.com/photo-1598514536338-8b399a0780f9?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chipotle-bowl",
    name: "Chipotle Chicken Bowl",
    category: "Bold flavors",
    description:
      "Smoky chipotle chicken, cilantro rice, black beans, and salsa. The bowl that inspired a chain, made better at home.",
    tags: ["20 min", "Flavorful", "Easy"],
    ingredients: ["Chicken", "Rice", "Beans", "Onions"],
    whyItFits: "Better than the restaurant version in the time it takes to order",
    image:
      "https://images.unsplash.com/photo-1546069596-0a240a65c31a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "mapo-beef",
    name: "Mapo-Style Ground Beef",
    category: "Bold flavors",
    description:
      "Spiced ground beef in a mouth-numbing Sichuan sauce over steamed rice. Weeknight Sichuan that delivers.",
    tags: ["25 min", "Flavorful", "Medium effort"],
    ingredients: ["Ground beef", "Garlic", "Onions", "Beans"],
    whyItFits: "Sichuan heat in a genuinely quick format",
    image:
      "https://images.unsplash.com/photo-1603133987046-a8a3d37521c4?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "lamb-shawarma",
    name: "Lamb Shawarma Plate",
    category: "Bold flavors",
    description:
      "Warm spiced meat in pita with tahini, tomatoes, and pickles. Middle Eastern street food at home.",
    tags: ["30 min", "Flavorful", "Medium effort"],
    ingredients: ["Garlic", "Onions", "Bread", "Tomatoes"],
    whyItFits: "Pita wraps everything together beautifully",
    image:
      "https://images.unsplash.com/photo-1555939594-58d7cb561ad1?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-mole",
    name: "Chicken Mole",
    category: "Bold flavors",
    description:
      "Rich Mexican mole sauce with chocolate, chilies, and warm spices over chicken. Complex, deep, unforgettable.",
    tags: ["45 min", "Flavorful", "Medium effort"],
    ingredients: ["Chicken", "Garlic", "Onions", "Tomatoes"],
    whyItFits: "The sauce with a hundred flavors that somehow works every time",
    image:
      "https://images.unsplash.com/photo-1501200291289-c5a76c232e5f?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "green-shakshuka",
    name: "Green Shakshuka",
    category: "Bold flavors",
    description:
      "Eggs poached in a spiced green tomatillo and spinach sauce. A brighter, lighter take on the classic.",
    tags: ["20 min", "Vegetarian", "Easy"],
    ingredients: ["Eggs", "Spinach", "Garlic", "Onions"],
    whyItFits: "The shakshuka that doesn't compete with the original",
    image:
      "https://images.unsplash.com/photo-1591985666643-9ce60217bae8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "beef-rendang",
    name: "Beef Rendang",
    category: "Bold flavors",
    description:
      "Indonesian slow-cooked beef caramelized in coconut milk and spices until richly glazed. Worth every minute.",
    tags: ["45 min", "Flavorful", "Medium effort"],
    ingredients: ["Ground beef", "Onions", "Garlic"],
    whyItFits: "The longer it cooks the better it gets",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tamarind-shrimp",
    name: "Tamarind Shrimp",
    category: "Bold flavors",
    description:
      "Shrimp in a tangy-sweet tamarind sauce with garlic and chilies. Southeast Asian punch in under 30 minutes.",
    tags: ["25 min", "Flavorful", "Easy"],
    ingredients: ["Shrimp", "Garlic", "Onions", "Tomatoes"],
    whyItFits: "Tangy, sweet, and spicy — the combination that always works",
    image:
      "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Healthy
  {
    id: "detox-chicken-soup",
    name: "Detox Chicken Soup",
    category: "Healthy",
    description:
      "Light chicken broth with spinach, ginger, turmeric, and lemon. Clean and restorative without being boring.",
    tags: ["30 min", "Nutritious", "Easy"],
    ingredients: ["Chicken", "Spinach", "Garlic", "Onions"],
    whyItFits: "The reset meal that actually tastes good",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "veggie-stir-fry",
    name: "Broccoli & Garlic Stir-Fry",
    category: "Healthy",
    description:
      "Broccoli florets wok-fried in garlic sauce and served over steamed rice. Clean, fast, plant-based.",
    tags: ["20 min", "Vegetarian", "Easy"],
    ingredients: ["Broccoli", "Garlic", "Onions", "Rice"],
    whyItFits: "Vegetables that actually taste like something",
    image:
      "https://images.unsplash.com/photo-1512852595523-54e2f8d8e9e7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "kale-chickpea-salad",
    name: "Kale & Chickpea Salad",
    category: "Healthy",
    description:
      "Massaged kale and roasted chickpeas with cherry tomatoes and lemon tahini. A salad that actually fills you up.",
    tags: ["15 min", "Vegetarian", "No-cook option"],
    ingredients: ["Beans", "Spinach", "Tomatoes"],
    whyItFits: "The salad that keeps you full until dinner",
    image:
      "https://images.unsplash.com/photo-1490645935967-10de6ba17061?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "salmon-tacos",
    name: "Salmon Tacos",
    category: "Healthy",
    description:
      "Blackened salmon in corn tortillas with pickled onions and lime crema. The lighter fish taco made elegant.",
    tags: ["20 min", "Light", "Easy"],
    ingredients: ["Salmon", "Tortillas", "Onions"],
    whyItFits: "Lighter than the beer-battered version and somehow better",
    image:
      "https://images.unsplash.com/photo-1551504734-5da7e163d3a2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chickpea-spinach-soup",
    name: "Chickpea & Spinach Soup",
    category: "Healthy",
    description:
      "Simmered chickpeas and wilted spinach in a spiced tomato broth. Plant-based protein without compromise.",
    tags: ["25 min", "Vegetarian", "Nutritious"],
    ingredients: ["Beans", "Spinach", "Garlic", "Tomatoes"],
    whyItFits: "Plant-based and filling in equal measure",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "shrimp-avocado-bowl",
    name: "Shrimp & Avocado Bowl",
    category: "Healthy",
    description:
      "Sautéed shrimp over rice with fresh tomatoes and avocado. Clean bowl with high protein and bright flavors.",
    tags: ["20 min", "Light", "Protein-packed"],
    ingredients: ["Shrimp", "Rice", "Tomatoes"],
    whyItFits: "Clean eating that actually tastes bright",
    image:
      "https://images.unsplash.com/photo-1580822184713-fc5400e7fe10?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "roasted-veggie-bowl",
    name: "Roasted Vegetable Bowl",
    category: "Healthy",
    description:
      "Roasted broccoli, peppers, and mushrooms over grains with tahini. The all-vegetable bowl that doesn't feel like a compromise.",
    tags: ["30 min", "Vegetarian", "Nutritious"],
    ingredients: ["Broccoli", "Bell peppers", "Mushrooms", "Garlic"],
    whyItFits: "The bowl that makes you forget you're eating healthy",
    image:
      "https://images.unsplash.com/photo-1513135467880-6c41603eb5e5?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "spinach-egg-cups",
    name: "Spinach Egg Cups",
    category: "Healthy",
    description:
      "Eggs baked in muffin tins with spinach, feta, and bacon bits. Meal-prepped protein for the whole week.",
    tags: ["20 min", "Meal-prep friendly", "Protein-packed"],
    ingredients: ["Eggs", "Spinach", "Cheese", "Bacon"],
    whyItFits: "Batch it once and have breakfast covered for days",
    image:
      "https://images.unsplash.com/photo-1510693206972-df098062cb71?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "tuna-rice-bowl",
    name: "Tuna Rice Bowl",
    category: "Healthy",
    description:
      "Flaked tuna over seasoned rice with cucumber and scallions. The no-fuss bowl that comes together from pantry basics.",
    tags: ["15 min", "Light", "Easy"],
    ingredients: ["Rice", "Onions", "Tomatoes"],
    whyItFits: "Pantry-ready and surprisingly satisfying",
    image:
      "https://images.unsplash.com/photo-1579871494447-9811cf80d66c?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "baked-salmon-veg",
    name: "Baked Salmon & Vegetables",
    category: "Healthy",
    description:
      "Sheet-pan salmon with lemon, garlic, and roasted broccoli. One pan, minimal cleanup, complete meal.",
    tags: ["25 min", "Protein-packed", "Nutritious"],
    ingredients: ["Salmon", "Broccoli", "Garlic", "Butter"],
    whyItFits: "One sheet pan, complete meal, nothing to argue with",
    image:
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "white-chicken-chili",
    name: "White Chicken Chili",
    category: "Healthy",
    description:
      "Chicken and white beans in a creamy green chile broth. A lighter, fresher alternative to classic chili.",
    tags: ["30 min", "Nutritious", "Easy"],
    ingredients: ["Chicken", "Beans", "Garlic", "Onions"],
    whyItFits: "All the satisfaction of chili without the weight",
    image:
      "https://images.unsplash.com/photo-1547592180-85f173990554?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "avocado-chicken-salad",
    name: "Avocado Chicken Salad",
    category: "Healthy",
    description:
      "Shredded chicken with avocado, tomato, and cilantro. Works as a wrap, a bowl, or by itself.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Chicken", "Tomatoes", "Onions"],
    whyItFits: "Zero cooking and still genuinely filling",
    image:
      "https://images.unsplash.com/photo-1512852595523-54e2f8d8e9e7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "poached-eggs-toast",
    name: "Poached Eggs on Toast",
    category: "Healthy",
    description:
      "Perfectly poached eggs over buttered toast with wilted spinach. When scrambled feels like settling.",
    tags: ["15 min", "Easy", "Light"],
    ingredients: ["Eggs", "Bread", "Spinach", "Butter"],
    whyItFits: "When scrambled feels like settling",
    image:
      "https://images.unsplash.com/photo-1541519481-1af5bde5b1d2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "spinach-frittata",
    name: "Spinach Frittata",
    category: "Healthy",
    description:
      "Oven-finished egg and spinach frittata with feta and onions. Slices like a pie, feeds a crowd, great cold.",
    tags: ["20 min", "Vegetarian", "Easy"],
    ingredients: ["Eggs", "Spinach", "Cheese", "Onions"],
    whyItFits: "The egg dish that feeds a crowd without extra effort",
    image:
      "https://images.unsplash.com/photo-1504674900247-0877df9cc836?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Elevated
  {
    id: "shrimp-scampi",
    name: "Shrimp Scampi",
    category: "Elevated",
    description:
      "Shrimp in white wine garlic butter over linguine. The Italian-American dish that feels fancy but takes under 25 minutes.",
    tags: ["20 min", "Elegant", "Easy"],
    ingredients: ["Shrimp", "Pasta", "Butter", "Garlic"],
    whyItFits: "Feels like date night but barely counts as cooking",
    image:
      "https://images.unsplash.com/photo-1534482421-64566f976cfa?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "beef-bourguignon",
    name: "Beef Bourguignon",
    category: "Elevated",
    description:
      "Beef braised in Burgundy wine with mushrooms, pearl onions, and bacon. Julia Child's favorite party trick.",
    tags: ["45 min", "Elegant", "Medium effort"],
    ingredients: ["Steak", "Mushrooms", "Onions", "Bacon"],
    whyItFits: "French luxury that rewards the effort generously",
    image:
      "https://images.unsplash.com/photo-1600891964092-4316c288032e?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pan-seared-fish",
    name: "Pan-Seared White Fish",
    category: "Elevated",
    description:
      "Delicate white fish with a golden sear, finished in brown butter with wilted spinach. Clean and restaurant-worthy.",
    tags: ["20 min", "Elegant", "Easy"],
    ingredients: ["Butter", "Garlic", "Spinach"],
    whyItFits: "The simplest path to a restaurant-quality plate",
    image:
      "https://images.unsplash.com/photo-1519984388953-d2406bc725e1?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-marsala",
    name: "Chicken Marsala",
    category: "Elevated",
    description:
      "Golden chicken cutlets in a Marsala wine and mushroom reduction. Italian-American at its most satisfying.",
    tags: ["25 min", "Elegant", "Easy"],
    ingredients: ["Chicken", "Mushrooms", "Butter", "Garlic"],
    whyItFits: "The Italian-American dish that earns its reputation",
    image:
      "https://images.unsplash.com/photo-1567188040759-fb8a883dc6d8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "seafood-linguine",
    name: "Seafood Linguine",
    category: "Elevated",
    description:
      "Linguine with shrimp and cherry tomatoes in white wine and garlic. Coastal Italian in under 30 minutes.",
    tags: ["25 min", "Elegant", "Medium effort"],
    ingredients: ["Pasta", "Shrimp", "Garlic", "Tomatoes"],
    whyItFits: "Coastal Italian that comes together fast",
    image:
      "https://images.unsplash.com/photo-1621996346565-e3dbc646d9a9?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "steak-au-poivre",
    name: "Steak au Poivre",
    category: "Elevated",
    description:
      "Pepper-crusted steak in a cognac cream sauce. The French bistro dinner that takes 20 minutes.",
    tags: ["20 min", "Elegant", "Easy"],
    ingredients: ["Steak", "Butter", "Garlic"],
    whyItFits: "The bistro plate you can actually pull off at home",
    image:
      "https://images.unsplash.com/photo-1544025162-d76694265947?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "shrimp-bisque",
    name: "Shrimp Bisque",
    category: "Elevated",
    description:
      "Silky cream bisque with shrimp, brandy, and tomato. The starter that becomes the whole meal.",
    tags: ["35 min", "Elegant", "Medium effort"],
    ingredients: ["Shrimp", "Butter", "Onions", "Garlic"],
    whyItFits: "Luxurious enough to be the main event",
    image:
      "https://images.unsplash.com/photo-1602743932936-1e4ee0b7419b?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "rack-of-lamb",
    name: "Rack of Lamb",
    category: "Elevated",
    description:
      "Herb-crusted rack of lamb roasted to a perfect pink. Dramatic presentation, manageable effort.",
    tags: ["30 min", "Elegant", "Medium effort"],
    ingredients: ["Garlic", "Butter"],
    whyItFits: "The showstopper that's actually manageable",
    image:
      "https://images.unsplash.com/photo-1574484284002-952d92456975?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "truffle-pasta",
    name: "Truffle Mushroom Pasta",
    category: "Elevated",
    description:
      "Tagliatelle in a rich mushroom and truffle butter sauce with aged parmesan. Decadence in 20 minutes.",
    tags: ["20 min", "Elegant", "Indulgent"],
    ingredients: ["Pasta", "Butter", "Cheese", "Mushrooms"],
    whyItFits: "Maximum decadence, minimum effort",
    image:
      "https://images.unsplash.com/photo-1611270629569-8b357cb88da9?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "seafood-cakes",
    name: "Crab-Style Seafood Cakes",
    category: "Elevated",
    description:
      "Pan-fried seafood cakes with a crispy exterior, served with remoulade. Elevated starter that works better as dinner.",
    tags: ["25 min", "Elegant", "Medium effort"],
    ingredients: ["Shrimp", "Eggs", "Butter", "Garlic"],
    whyItFits: "Fancy starters that work better as dinner",
    image:
      "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Classic Italian
  {
    id: "cacio-e-pepe",
    name: "Cacio e Pepe",
    category: "Classic Italian",
    description:
      "Just pasta, pecorino, butter, and freshly cracked pepper. Three ingredients, perfect execution.",
    tags: ["15 min", "Elegant", "Easy"],
    ingredients: ["Pasta", "Cheese", "Butter"],
    whyItFits: "Roman simplicity that takes 15 minutes and tastes earned",
    image:
      "https://images.unsplash.com/photo-1563379926898-05f4575a45d8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pasta-amatriciana",
    name: "Pasta all'Amatriciana",
    category: "Classic Italian",
    description:
      "Guanciale, San Marzano tomatoes, and pecorino. The Roman pasta that beats your average tomato sauce every time.",
    tags: ["25 min", "Flavorful", "Easy"],
    ingredients: ["Pasta", "Bacon", "Tomatoes", "Onions"],
    whyItFits: "Better than pomodoro without much more effort",
    image:
      "https://images.unsplash.com/photo-1598866593549-d8e0d60a3d37?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "osso-buco",
    name: "Osso Buco",
    category: "Classic Italian",
    description:
      "Slow-braised beef shank with gremolata in a rich tomato and wine reduction. The Milanese slow-cook masterpiece.",
    tags: ["45 min", "Elegant", "Medium effort"],
    ingredients: ["Steak", "Tomatoes", "Onions", "Garlic"],
    whyItFits: "The Italian classic that rewards patience",
    image:
      "https://images.unsplash.com/photo-1574673093985-59c47f1d64b5?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "puttanesca",
    name: "Pasta Puttanesca",
    category: "Classic Italian",
    description:
      "Olives, capers, anchovies, and tomatoes over spaghetti. The bold pantry pasta with genuine attitude.",
    tags: ["20 min", "Flavorful", "Easy"],
    ingredients: ["Pasta", "Tomatoes", "Garlic", "Onions"],
    whyItFits: "Big personality from pantry ingredients",
    image:
      "https://images.unsplash.com/photo-1572695157366-5e585ab2b69f?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "minestrone",
    name: "Minestrone Soup",
    category: "Classic Italian",
    description:
      "Thick Italian vegetable and pasta soup with cannellini beans and parmesan rind. Filling and deeply savory.",
    tags: ["30 min", "Vegetarian", "Nutritious"],
    ingredients: ["Pasta", "Beans", "Tomatoes", "Onions"],
    whyItFits: "The Italian soup that's a complete meal by itself",
    image:
      "https://images.unsplash.com/photo-1547592166-23ac45744acd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "saltimbocca",
    name: "Saltimbocca",
    category: "Classic Italian",
    description:
      "Chicken with prosciutto and sage pan-finished in white wine and butter. Italian technique in 20 minutes.",
    tags: ["20 min", "Elegant", "Easy"],
    ingredients: ["Chicken", "Bacon", "Butter", "Garlic"],
    whyItFits: "Simple Italian method that produces something genuinely impressive",
    image:
      "https://images.unsplash.com/photo-1559847844-5315695dadae?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "cheese-ravioli",
    name: "Cheese Ravioli",
    category: "Classic Italian",
    description:
      "Ricotta-stuffed ravioli with butter and sage or simple tomato sauce. The pasta shape that wins every vote.",
    tags: ["20 min", "Kid-friendly", "Easy"],
    ingredients: ["Pasta", "Cheese", "Butter", "Tomatoes"],
    whyItFits: "The pasta shape everyone loves, minimal effort required",
    image:
      "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "focaccia-bread",
    name: "Focaccia with Caramelized Onions",
    category: "Classic Italian",
    description:
      "Dimpled olive oil focaccia with rosemary and caramelized onions. The bread that's also a meal.",
    tags: ["30 min", "Vegetarian", "Easy"],
    ingredients: ["Bread", "Garlic", "Onions"],
    whyItFits: "Bread that's enough to be dinner",
    image:
      "https://images.unsplash.com/photo-1516100882582-96c3a05fe590?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Mediterranean
  {
    id: "fattoush",
    name: "Fattoush Salad",
    category: "Mediterranean",
    description:
      "Toasted pita, tomatoes, cucumber, herbs, and sumac dressing. The Middle Eastern chopped salad with crunch.",
    tags: ["15 min", "Vegetarian", "No-cook option"],
    ingredients: ["Bread", "Tomatoes", "Onions"],
    whyItFits: "The salad where the stale bread becomes the best part",
    image:
      "https://images.unsplash.com/photo-1541014741259-de529411b96a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "mujaddara",
    name: "Mujaddara",
    category: "Mediterranean",
    description:
      "Lentils and rice topped with deeply caramelized onions. A humble Lebanese dish of extraordinary satisfaction.",
    tags: ["30 min", "Vegetarian", "Nutritious"],
    ingredients: ["Rice", "Beans", "Onions"],
    whyItFits: "Humble ingredients, surprising depth",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "baba-ghanoush",
    name: "Baba Ganoush Plate",
    category: "Mediterranean",
    description:
      "Smoky eggplant dip with tahini, garlic, and warm pita. A different direction from hummus, equally good.",
    tags: ["15 min", "Vegetarian", "No-cook option"],
    ingredients: ["Garlic", "Bread", "Tomatoes"],
    whyItFits: "Different from hummus and equally satisfying",
    image:
      "https://images.unsplash.com/photo-1577906071869-7c74a8ebd15?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "foul-medames",
    name: "Foul Medames",
    category: "Mediterranean",
    description:
      "Egyptian stewed fava beans with olive oil, lemon, and cumin. The breakfast dish eaten at all hours.",
    tags: ["20 min", "Vegetarian", "Nutritious"],
    ingredients: ["Beans", "Garlic", "Tomatoes", "Onions"],
    whyItFits: "A dish eaten at breakfast, lunch, and dinner for good reason",
    image:
      "https://images.unsplash.com/photo-1540189549336-e6e99c3679fe?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "sabich",
    name: "Sabich Sandwich",
    category: "Mediterranean",
    description:
      "Israeli pita sandwich with fried egg, tomatoes, pickled mango, and tahini. Tel Aviv street food at home.",
    tags: ["20 min", "Vegetarian", "Easy"],
    ingredients: ["Bread", "Eggs", "Tomatoes", "Onions"],
    whyItFits: "The Israeli sandwich most people haven't tried yet",
    image:
      "https://images.unsplash.com/photo-1561626423-a51b45aef0a1?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "turkish-eggs",
    name: "Turkish Eggs",
    category: "Mediterranean",
    description:
      "Poached eggs over garlicky yogurt with chili butter. Turkish brunch that's as beautiful as it is fast.",
    tags: ["15 min", "Vegetarian", "Easy"],
    ingredients: ["Eggs", "Butter", "Garlic"],
    whyItFits: "The breakfast that looks like it took way more effort",
    image:
      "https://images.unsplash.com/photo-1591985666643-9ce60217bae8?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "lahmacun",
    name: "Lahmacun",
    category: "Mediterranean",
    description:
      "Turkish spiced meat flatbread with herbs and lemon. The Middle Eastern pizza that's been there longer.",
    tags: ["25 min", "Flavorful", "Easy"],
    ingredients: ["Ground beef", "Bread", "Tomatoes", "Onions"],
    whyItFits: "The flatbread pizza that predates pizza",
    image:
      "https://images.unsplash.com/photo-1574894709920-11b28e7367e3?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "spanakopita",
    name: "Spanakopita",
    category: "Mediterranean",
    description:
      "Spinach and feta in crispy phyllo pastry. The Greek savory pie that justifies every layer.",
    tags: ["35 min", "Vegetarian", "Medium effort"],
    ingredients: ["Eggs", "Spinach", "Cheese", "Butter"],
    whyItFits: "Greek pastry worth the medium effort",
    image:
      "https://images.unsplash.com/photo-1565557623262-b51c2513a641?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Fresh
  {
    id: "banh-mi",
    name: "Bánh Mì Sandwich",
    category: "Fresh",
    description:
      "Grilled chicken, pickled vegetables, jalapeño, and cilantro in a crusty baguette. Vietnamese flavor fusion.",
    tags: ["20 min", "Flavorful", "Easy"],
    ingredients: ["Bread", "Chicken", "Onions", "Tomatoes"],
    whyItFits: "The sandwich that changed what sandwiches could be",
    image:
      "https://images.unsplash.com/photo-1553979459-d2229ba7433a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "prawn-cocktail",
    name: "Prawn Cocktail",
    category: "Fresh",
    description:
      "Chilled shrimp with classic cocktail sauce and lemon. The dinner party starter that becomes the whole meal.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Shrimp", "Tomatoes", "Onions"],
    whyItFits: "Effortless, fresh, and classically satisfying",
    image:
      "https://images.unsplash.com/photo-1551218808-94e220e084d2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "gazpacho",
    name: "Gazpacho",
    category: "Fresh",
    description:
      "Blended chilled tomato soup with cucumber, garlic, and sherry vinegar. Spanish summer in a bowl, no heat required.",
    tags: ["15 min", "Vegetarian", "No-cook option"],
    ingredients: ["Tomatoes", "Garlic", "Onions", "Bell peppers"],
    whyItFits: "The soup that requires no cooking and still impresses",
    image:
      "https://images.unsplash.com/photo-1546069596-0a240a65c31a?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "smoked-salmon-plate",
    name: "Smoked Salmon Plate",
    category: "Fresh",
    description:
      "Thinly sliced smoked salmon with capers, red onion, and crème fraîche on dark bread. No cooking needed.",
    tags: ["15 min", "No-cook option", "Light"],
    ingredients: ["Salmon", "Bread", "Onions"],
    whyItFits: "No cooking, looks like you tried, tastes like you did",
    image:
      "https://images.unsplash.com/photo-1519708227418-c8fd9a32b7a2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "gado-gado",
    name: "Gado Gado",
    category: "Fresh",
    description:
      "Indonesian salad of eggs, beans, and greens with a rich peanut sauce. The salad with a sauce that steals the show.",
    tags: ["25 min", "Vegetarian", "Nutritious"],
    ingredients: ["Eggs", "Beans", "Spinach"],
    whyItFits: "The peanut sauce alone is worth making",
    image:
      "https://images.unsplash.com/photo-1512621776951-a57141f2eefd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "cold-soba",
    name: "Cold Soba Noodles",
    category: "Fresh",
    description:
      "Buckwheat noodles chilled in dashi broth with wasabi and scallions. Japanese minimalism at its finest.",
    tags: ["15 min", "Vegetarian", "Light"],
    ingredients: ["Noodles", "Garlic", "Onions"],
    whyItFits: "The Japanese noodle dish that's better cold",
    image:
      "https://images.unsplash.com/photo-1569050483838-ad30f408c1d7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "thai-larb",
    name: "Thai Larb",
    category: "Fresh",
    description:
      "Minced meat salad with toasted rice powder, lime, and fresh herbs. Thai flavor intensity in a light form.",
    tags: ["25 min", "Flavorful", "Light"],
    ingredients: ["Ground beef", "Onions", "Garlic"],
    whyItFits: "Bold Thai flavors in a dish that doesn't weigh you down",
    image:
      "https://images.unsplash.com/photo-1559314045-0c04de3ebfce?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "cobb-salad",
    name: "Cobb Salad",
    category: "Fresh",
    description:
      "Grilled chicken, crispy bacon, hard-boiled egg, and tomato over romaine with blue cheese dressing.",
    tags: ["15 min", "Easy", "Protein-packed"],
    ingredients: ["Chicken", "Eggs", "Bacon", "Tomatoes"],
    whyItFits: "Everything protein-wise in one generous bowl",
    image:
      "https://images.unsplash.com/photo-1512852595523-54e2f8d8e9e7?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "mushroom-spinach-salad",
    name: "Warm Mushroom & Spinach Salad",
    category: "Fresh",
    description:
      "Sautéed mushrooms and spinach in garlic butter. The warm salad that works as a side or a solo meal.",
    tags: ["15 min", "Vegetarian", "Easy"],
    ingredients: ["Mushrooms", "Spinach", "Garlic", "Butter"],
    whyItFits: "Warm, umami-forward, done in 15 minutes",
    image:
      "https://images.unsplash.com/photo-1506280754576-f6fa8a873550?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "cold-noodle-salad",
    name: "Cold Noodle Salad",
    category: "Fresh",
    description:
      "Glass noodles with julienned peppers, spinach, and a tangy sesame dressing. Light, Asian-inspired, satisfying cold.",
    tags: ["15 min", "Vegetarian", "Light"],
    ingredients: ["Noodles", "Spinach", "Bell peppers", "Garlic"],
    whyItFits: "The cold noodle salad that refreshes without filling you up",
    image:
      "https://images.unsplash.com/photo-1553279768-865429fa0078?auto=format&fit=crop&w=600&h=750&q=80",
  },

  // Crowd pleaser
  {
    id: "sliders",
    name: "Mini Beef Sliders",
    category: "Crowd pleaser",
    description:
      "Two-bite burgers with melted cheese and caramelized onions on soft rolls. The party food that becomes the whole meal.",
    tags: ["25 min", "Kid-friendly", "Crowd pleaser"],
    ingredients: ["Ground beef", "Bread", "Cheese", "Onions"],
    whyItFits: "Mini burgers disappear faster than full ones",
    image:
      "https://images.unsplash.com/photo-1568901346375-23c9450c58cd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pizza-rolls",
    name: "Homemade Pizza Rolls",
    category: "Crowd pleaser",
    description:
      "Rolled dough filled with cheese, sausage, and tomato sauce, baked until golden. Everyone wants five more.",
    tags: ["25 min", "Kid-friendly", "Easy"],
    ingredients: ["Bread", "Cheese", "Tomatoes", "Sausage"],
    whyItFits: "Everyone wants five more after the first one",
    image:
      "https://images.unsplash.com/photo-1574071318508-1cdbab80d002?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "corn-dogs",
    name: "Corn Dogs",
    category: "Crowd pleaser",
    description:
      "Hot dogs wrapped in sweet cornbread batter, baked or fried until golden. Fairground food, homemade.",
    tags: ["25 min", "Kid-friendly", "Easy"],
    ingredients: ["Sausage", "Eggs", "Bread"],
    whyItFits: "The fair food that's just as good at home",
    image:
      "https://images.unsplash.com/photo-1612392062631-94440b33ef54?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "bbq-ribs",
    name: "BBQ Ribs",
    category: "Crowd pleaser",
    description:
      "Slow-roasted ribs glazed with sticky BBQ sauce. Messy, communal, and utterly satisfying.",
    tags: ["45 min", "Crowd pleaser", "Grill night"],
    ingredients: ["Steak", "Garlic", "Onions"],
    whyItFits: "Requires napkins. That's always a good sign.",
    image:
      "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "chicken-parmesan",
    name: "Chicken Parmesan",
    category: "Crowd pleaser",
    description:
      "Crispy breaded chicken, tomato sauce, and melted mozzarella. The Italian-American dish that never gets old.",
    tags: ["35 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Chicken", "Cheese", "Tomatoes", "Eggs"],
    whyItFits: "Crowd pleaser that's been earning that title for decades",
    image:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "meatball-subs",
    name: "Meatball Subs",
    category: "Crowd pleaser",
    description:
      "Juicy beef meatballs in marinara smothered with mozzarella in a toasted hoagie. The game-day essential.",
    tags: ["30 min", "Crowd pleaser", "Easy"],
    ingredients: ["Ground beef", "Bread", "Cheese", "Tomatoes"],
    whyItFits: "The sub that ends all arguments about dinner",
    image:
      "https://images.unsplash.com/photo-1607116667981-ff148b3a63de?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "buffalo-chicken-dip",
    name: "Buffalo Chicken Dip",
    category: "Crowd pleaser",
    description:
      "Hot, creamy, cheesy buffalo chicken in a skillet. Serve with chips or bread and watch it disappear.",
    tags: ["20 min", "Crowd pleaser", "Easy"],
    ingredients: ["Chicken", "Cheese", "Butter", "Garlic"],
    whyItFits: "You'll run out before you want to",
    image:
      "https://images.unsplash.com/photo-1562967914-608f82629710?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "southern-fried-chicken",
    name: "Southern Fried Chicken",
    category: "Crowd pleaser",
    description:
      "Crispy buttermilk-brined fried chicken. The benchmark dish that all other fried chicken aspires to be.",
    tags: ["40 min", "Crowd pleaser", "Medium effort"],
    ingredients: ["Chicken", "Eggs", "Bread"],
    whyItFits: "When only the real thing will do",
    image:
      "https://images.unsplash.com/photo-1527477396000-e27163b481c2?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "shrimp-boil",
    name: "Shrimp Boil",
    category: "Crowd pleaser",
    description:
      "Old Bay shrimp, andouille, corn, and potatoes boiled together and dumped on the table. Communal eating at its best.",
    tags: ["35 min", "Crowd pleaser", "Grill night"],
    ingredients: ["Shrimp", "Potatoes", "Sausage", "Onions"],
    whyItFits: "Dump it on the table and everyone digs in",
    image:
      "https://images.unsplash.com/photo-1565299507177-b0ac66763828?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "fried-chicken-sandwich",
    name: "Fried Chicken Sandwich",
    category: "Crowd pleaser",
    description:
      "Crispy fried chicken thigh, pickles, and slaw in a brioche bun. The sandwich the internet keeps arguing about.",
    tags: ["25 min", "Crowd pleaser", "Indulgent"],
    ingredients: ["Chicken", "Bread", "Eggs"],
    whyItFits: "The sandwich that's always worth the hype",
    image:
      "https://images.unsplash.com/photo-1550547660-d9450f859349?auto=format&fit=crop&w=600&h=750&q=80",
  },
  {
    id: "pigs-in-blankets",
    name: "Pigs in Blankets",
    category: "Crowd pleaser",
    description:
      "Cocktail sausages wrapped in flaky crescent dough, baked until golden. The snack that disappears within minutes.",
    tags: ["20 min", "Kid-friendly", "Easy"],
    ingredients: ["Sausage", "Bread", "Eggs"],
    whyItFits: "The one nobody ever stops at just one",
    image:
      "https://images.unsplash.com/photo-1612392062631-94440b33ef54?auto=format&fit=crop&w=600&h=750&q=80",
  },
];
