export type Meal = {
  id: string;
  name: string;
  category: string;
  description: string;
  tags: string[];
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
    whyItFits: "Hard to argue with BBQ chicken",
    image:
      "https://images.unsplash.com/photo-1529193591184-b1d58069ecdd?auto=format&fit=crop&w=600&h=750&q=80",
  },
];
