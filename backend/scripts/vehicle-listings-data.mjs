// Vehicle-listing seed content, sourced verbatim from the reference vehicle
// pages on letsgocaravanandcamping.com.au (one entry per RV type). The "RV
// Finder is a free…" service blurb and list lead-in sentences from those pages
// are intentionally omitted — the detail page carries its own quiz CTA and
// renders the amenities as structured spec sections instead.
//
// Shape is transformed into the Strapi payload by seed-vehicle-listings.mjs
// (overview → blocks, spec-section bullets → icon list-items, card features →
// first three "why choose" points, watchVideoUrl from videoId).

export const VEHICLES = [
  {
    title: "Camper Trailers",
    slug: "camper-trailer",
    order: 1,
    priceFrom: 18000,
    priceTo: 90000,
    videoId: "qbio3YLoB8U",
    cardImage: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2025/06/camper-trailer.jpg",
    overviewHeading: "Overview",
    overview: [
      "Camper trailers are one of the most budget-friendly and versatile ways to experience the freedom of camping. Compact and packed with smart features, they’re ideal for solo travellers, couples, and even larger families who want to enjoy the great outdoors with added comfort.",
      "Thanks to their lightweight design, camper trailers can be towed by SUVs, smaller 4WDs or even sedans. Whether you’re heading off-road or planning a road trip on the bitumen, there’s a camper trailer to suit your travel style.",
      "Camper trailers are built for convenience. Their compact size makes them easy to tow and even easier to store—whether that’s in a garage, carport or backyard shed.",
      "There’s a camper trailer for every travel group. Layouts range from solo setups to models that can comfortably sleep up to six people—ideal for families or friends hitting the road together.",
      "Camper trailers are compact while travelling, but once you’re set up, they expand to offer generous living space. Many models include annexes or extra rooms for added comfort. Setup is quick and simple—so you can spend more time enjoying the great outdoors.",
    ],
    whyChoose: [
      "Budget-friendly and easy to tow",
      "Ideal for short trips or long adventures",
      "Flexible layouts for singles, couples, and families",
      "Compact for travel, spacious when set up",
      "Comfortable, convenient, and made for the outdoors",
    ],
    specSections: [
      {
        label: "Amenities",
        bullets: [
          "Slide-out kitchens with gas cooktops or hot plates",
          "Sink with hot & cold water",
          "Room for a chest-style fridge/freezer",
          "Fresh water tanks for your travels",
        ],
      },
      {
        label: "Power Options",
        bullets: [
          "12V battery systems for lights and device charging",
          "240V mains inlet and outlets for larger appliances",
          "Solar panels and inverters on many models for off-grid capability",
        ],
      },
    ],
  },

  {
    title: "Camper Vans",
    slug: "camper-van",
    order: 2,
    priceFrom: 80000,
    priceTo: 230000,
    videoId: "ARsSl3QMKmg",
    cardImage: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2025/06/campervan.jpg",
    overviewHeading: "Overview",
    overview: [
      "Ready to hit the road in comfort and style? Campervans are one of the most versatile and compact ways to explore Australia. Whether you're travelling solo, as a couple, or with a small family, campervans offer the perfect mix of holiday, lifestyle and transport—all rolled into one sleek, easy-to-drive vehicle.",
      "Thanks to their compact size, campervans can be stored in a carport, garage or shed, making them ideal for those with limited space at home.",
      "Designed with flexibility in mind, campervans come in layouts that can sleep one to four people comfortably. Perfect for solo travellers, couples, or small families seeking adventure on the road.",
      "Everything you need, packed into a cleverly designed space.",
      "Whether you're in a powered site or free camping, you'll have the energy to keep going.",
      "Campervans make the most of their space with clever cabinetry and internal design, giving you ample room for your belongings. Many also feature external storage options and awnings, offering even more living space when parked.",
    ],
    whyChoose: [
      "Compact and easy to drive",
      "Packed with all the essentials",
      "Ideal for short trips or long adventures",
      "Great for solo travellers, couples or small families",
      "Stylish, self-contained, and ready for the open road",
    ],
    specSections: [
      {
        label: "Amenities",
        bullets: [
          "Modern kitchen with hot plates and sink (hot & cold water)",
          "Upright fridge/freezer",
          "Air conditioning and hot water system",
          "Fresh water tanks for drinking and washing",
          "Exterior awning for shaded outdoor living and dining",
        ],
      },
      {
        label: "Power Supply",
        bullets: [
          "12V battery systems to power lights and USB charging ports",
          "Solar panels to maintain charge while off-grid",
          "240V mains inlets and power points for home comforts like air fryers or coffee machines",
        ],
      },
    ],
  },

  {
    title: "Motorhomes",
    slug: "motor-home",
    order: 3,
    priceFrom: 120000,
    priceTo: 500000,
    videoId: "niuVQQjxWyo",
    cardImage: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2025/06/motorhome.jpg",
    overviewHeading: "Overview",
    overview: [
      "Motorhomes are the ultimate in no-fuss, luxury travel—like having a spacious apartment on wheels. Built on sturdy truck chassis and up to 40 feet long, they offer self-drive convenience without the need for towing, and most can be driven on a standard car licence.",
    ],
    whyChoose: [
      "Luxury and space for effortless travel",
      "No setup stress—just drive in, plug in and relax",
      "Perfect for a lap of Australia or short, spontaneous getaways",
      "Combine holiday, lifestyle and transport in one vehicle",
    ],
    specSections: [
      {
        label: "Terrain & Travel",
        bullets: [
          "Road use: Most motorhomes are designed for sealed roads, offering smooth touring across Australia.",
          "Adventure-ready options: Some manufacturers offer custom off-road models for those seeking rugged travel.",
        ],
      },
      {
        label: "Sleeping Capacity",
        bullets: ["Solo & couples", "Families up to six"],
      },
      {
        label: "Amenities & Comfort",
        bullets: [
          "Ensuite bathroom with shower, toilet and vanity",
          "Fully equipped kitchens with hot plates, oven, microwave or induction cooktop",
          "Large fridge/freezer and generous water tanks",
          "Air conditioning and, in premium models, diesel heating",
          "Luxury extras: Some models feature a washing machine, dryer, and advanced entertainment systems.",
        ],
      },
      {
        label: "Power & Technology",
        bullets: [
          "12V battery system for lights, USB charging and TV",
          "240V mains connection for home appliances",
          "Built-in inverters in some models for 240V use off-grid",
          "Optional solar systems and satellite connectivity for internet and streaming",
        ],
      },
      {
        label: "Storage & Outdoor Living",
        bullets: [
          "Ample storage: Internal cabinetry and external lockers keep all your gear organised",
          "Slide-out sections on some models expand your living space",
          "Exterior awnings create outdoor rooms, often with lighting, speakers, and TVs for al fresco relaxation",
        ],
      },
    ],
  },

  {
    title: "Large Caravans",
    slug: "caravan",
    order: 4,
    priceFrom: 55000,
    priceTo: 200000,
    videoId: "Rq_Y8A0p83I",
    cardImage: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2025/06/large-caravan.jpg",
    overviewHeading: "Overview",
    overview: [
      "Large caravans are a true home away from home. With lengths of up to 26 feet and built on dual or even triple axles for enhanced stability, they offer generous indoor living spaces, packed with the modern comforts travellers love. Whether you’re touring the country or enjoying a long weekend away, large caravans deliver the perfect mix of space, luxury and convenience.",
      "Due to their size, large caravans require a suitable tow vehicle—typically a large SUV or 4WD. Some of the largest models may need an American-style pickup. Available in both touring and off-road configurations, they cater to all types of travel—from highway cruising to outback adventures.",
      "Modern features like reversing cameras take the stress out of manoeuvring, making setup at your destination even easier.",
      "Designed for all types of travellers—solo adventurers, couples or families—large caravans typically sleep up to six people. Most feature a double or queen bed as standard, with options like convertible living areas and bunk beds for the kids.",
    ],
    whyChoose: [
      "Australia’s most popular RV type",
      "Ideal for long trips or extended stays",
      "Spacious, comfortable layouts for up to six people",
      "Packed with premium amenities and storage",
      "Built for both road touring and off-road adventures",
    ],
    specSections: [
      {
        label: "Comfort & Amenities",
        bullets: [
          "Air conditioning",
          "Ensuite bathroom with toilet, vanity and shower",
          "Fully equipped internal kitchen with hot plates, microwave, fridge-freezer and sink with hot & cold water",
          "Laundry amenities such as washer/dryer combos in premium models",
          "Multiple fresh and grey water tanks for extended stays",
        ],
      },
      {
        label: "Power Supply",
        bullets: [
          "12V battery system for lights, USB charging and devices",
          "240V mains inlet & power points for high-powered appliances like air fryers and coffee machines",
          "Roof-mounted solar panels to recharge batteries on the go",
          "TV and inverter systems in many models for off-grid convenience",
        ],
      },
      {
        label: "Storage & Outdoor Living",
        bullets: [
          "Mood lighting",
          "Outdoor speakers",
          "Entertainment systems, including external TVs",
        ],
      },
    ],
  },

  {
    title: "Hybrid / Pop Top",
    slug: "pop-top",
    order: 5,
    priceFrom: 34000,
    priceTo: 110000,
    videoId: "F70wStbI0_o",
    cardImage: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2025/06/hybrid-pop-top.jpg",
    overviewHeading: "Overview",
    overview: [
      "Hybrid and pop top caravans have exploded in popularity—and it’s easy to see why. Perfect for couples and small families, these compact RVs are packed with comfort, smart design, and modern features.",
      "The pop top roof lowers the van’s overall height, making it easy to store in a carport, garage or shed. And when you arrive? Just park, unhitch, pop the roof, roll out the awning—and you’re ready in 10 minutes!",
      "These vans are lightweight and easy to tow, making them suitable for medium sedans, SUVs or smaller 4WDs.",
      "Despite the smaller size, you’ll enjoy comparable internal space to a traditional caravan thanks to clever design.",
    ],
    whyChoose: [
      "Lightweight and easy to tow",
      "Fast to set up—ideal for weekend escapes or big trips",
      "Compact, but cleverly designed for spacious living",
      "Packed with features—without the big price tag",
      "Great fuel economy and low profile for better storage",
    ],
    specSections: [
      {
        label: "Towing & Terrain",
        bullets: [
          "Choose between Touring or Off-Road models depending on your travel style",
          "Compact design improves fuel efficiency and visibility",
          "Perfect for tight tracks, bushland or urban navigation",
        ],
      },
      {
        label: "Sleeping Capacity",
        bullets: ["Solo adventurers", "Travelling couples", "Small families"],
      },
      {
        label: "Amenities",
        bullets: [
          "A modern kitchen with hot plates and sink (hot & cold water)",
          "Room for a fridge or freezer (chest or upright)",
          "Fresh water tanks for drinking and washing",
          "Some models include toilets and onboard showers",
          "Many feature external slide-out kitchens for open-air cooking",
        ],
      },
      {
        label: "Power Supply",
        bullets: [
          "12V onboard battery systems for lights, USB ports and essentials",
          "240V mains connection for home-style appliances",
          "Onboard battery charger for recharging",
          "Optional solar systems and inverters for off-grid capability",
        ],
      },
      {
        label: "Storage & Outdoor Living",
        bullets: [
          "Impressive internal and external storage for your gear",
          "Exterior awnings and outdoor kitchen setups",
          "Small fridges and prep areas help you enjoy the great outdoors with ease",
        ],
      },
    ],
  },

  {
    title: "Small Caravans",
    slug: "small-caravan",
    order: 6,
    priceFrom: 20000,
    priceTo: 50000,
    videoId: "BPfai678dNU",
    cardImage: "https://www.letsgocaravanandcamping.com.au/wp-content/uploads/2025/06/small-caravan.jpg",
    overviewHeading: "Overview",
    overview: [
      "Small single axle caravans are the perfect choice for couples, solo travellers and small families. Don’t be fooled by their size—at up to 19 feet long, these caravans are cleverly designed to include all the creature comforts of larger models while offering a more compact, towable, and affordable alternative.",
      "Setting up is a breeze: reverse into your site, unhitch, drop the stabilisers, roll out the awning—and relax!",
    ],
    whyChoose: [
      "Easy to tow, easy to store",
      "Comfortable and well-equipped",
      "Budget-friendly without sacrificing features",
      "Great for first-time buyers or seasoned travellers",
      "Versatile layouts for up to 5 people",
      "Ready for both touring and off-road adventures",
    ],
    specSections: [
      {
        label: "Towing & Terrain",
        bullets: [
          "Lightweight and easy to tow with medium SUVs, sedans or 4WDs",
          "Ideal for those new to caravanning or wanting to downsize",
          "Available in Touring and Off-Road options for added flexibility",
          "Many models include reversing cameras to make site manoeuvring a breeze",
        ],
      },
      {
        label: "Sleeping Capacity",
        bullets: ["Solo travellers", "Couples", "Small families"],
      },
      {
        label: "Amenities",
        bullets: [
          "Modern kitchen with fridge/freezer, hot plates, and a sink with hot & cold water",
          "Fresh water tanks for drinking and washing",
          "Toilets and onboard showers in select models",
          "Pop-out awnings to extend your living space outdoors",
        ],
      },
      {
        label: "Power Supply",
        bullets: [
          "12V onboard battery systems for lighting, TV and device charging",
          "240V mains inlet and power points for your favourite appliances",
          "Roof-mounted solar systems standard on many models",
          "Battery maintenance systems included in most layouts",
        ],
      },
      {
        label: "Storage & Outdoor Living",
        bullets: [
          "Ample internal cabinetry",
          "External lockers for outdoor gear",
          "Awning spaces to create a relaxing outdoor area or extra storage",
          "Ideal for organised travellers wanting functionality without bulk",
        ],
      },
    ],
  },
];
