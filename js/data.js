/* Annapurna Podulu — seed catalog & default settings.
   Prices are starting values; the owner edits them in Admin → Products. */
window.SEED = {
  settings: {
    shopName: 'Annapurna Podulu',
    tagline: 'Traditional Taste… Always',
    upiId: 'annapurnapodulu@ybl',        // ← replace with the shop's PhonePe UPI ID
    payeeName: 'Annapurna Podulu',
    whatsapp: '9951071111',
    city: 'Akkayyapalem, Visakhapatnam',
    deliveryFee: 40,
    freeDeliveryAbove: 499,
    pincodePrefixes: '530,531',          // serviceable pincodes (starts with)
    adminPin: '1234'
  },
  products: [
    {
      id: 'karivepaku', name: 'Karivepaku Podi', te: 'కరివేపాకు పొడి', heat: 2, color: '#4f6b2a',
      short: 'Roasted curry leaves, dals and garlic. Mix with hot rice and ghee.',
      description: 'Fresh curry leaves are dry-roasted till crisp and stone-ground with urad dal, chana dal, red chillies, garlic and a touch of tamarind. Earthy, aromatic and good for everyday meals.',
      ingredients: 'Curry leaves, urad dal, chana dal, red chillies, garlic, cumin, tamarind, salt',
      pairs: 'Hot rice + ghee, idli, dosa',
      images: ['img/products/karivepaku.jpg', 'img/products/karivepaku-pack.jpg', 'img/products/karivepaku-closeup.jpg'],
      variants: [{ w: '100 g', p: 75 }, { w: '250 g', p: 160 }, { w: '500 g', p: 300 }],
      inStock: true, bestseller: true
    },
    {
      id: 'kandi', name: 'Kandi Podi', te: 'కంది పొడి', heat: 2, color: '#d98a1c',
      short: 'The Andhra classic. Roasted toor dal with red chilli and garlic.',
      description: 'Toor dal is slow-roasted to a deep golden colour and ground coarse with red chillies, cumin and garlic. The first-bite podi of every Andhra lunch plate.',
      ingredients: 'Toor dal, red chillies, cumin, garlic, salt',
      pairs: 'Hot rice + ghee, curd rice side',
      images: ['img/products/kandi.jpg', 'img/products/kandi-pack.jpg', 'img/products/kandi-closeup.jpg'],
      variants: [{ w: '100 g', p: 70 }, { w: '250 g', p: 150 }, { w: '500 g', p: 285 }],
      inStock: true, bestseller: true
    },
    {
      id: 'nuvvula', name: 'Nuvvula Podi', te: 'నువ్వుల పొడి', heat: 1, color: '#c9a77a',
      short: 'Nutty roasted sesame with a gentle chilli warmth.',
      description: 'White sesame seeds roasted until they pop, ground with urad dal and a few red chillies. Mild, nutty and rich in calcium, a favourite with children and elders.',
      ingredients: 'Sesame seeds, urad dal, red chillies, salt',
      pairs: 'Rice + gingelly oil, idli, upma',
      images: ['img/products/nuvvula.jpg', 'img/products/nuvvula-pack.jpg', 'img/products/nuvvula-closeup.jpg'],
      variants: [{ w: '100 g', p: 80 }, { w: '250 g', p: 170 }, { w: '500 g', p: 320 }],
      inStock: true
    },
    {
      id: 'munagaku', name: 'Munagaku Karam Podi', te: 'మునగాకు కారం పొడి', heat: 2, color: '#7d8a2e',
      short: 'Drumstick (moringa) leaves with dals and chilli. Iron-rich.',
      description: 'Tender drumstick leaves are shade-dried, roasted and ground with dals, red chillies, garlic and cumin. A nourishing karam podi made the way it is made at home.',
      ingredients: 'Drumstick leaves, chana dal, urad dal, red chillies, garlic, cumin, salt',
      pairs: 'Hot rice + ghee, dosa, chapati',
      images: ['img/products/munagaku.jpg', 'img/products/munagaku-pack.jpg', 'img/products/munagaku-closeup.jpg'],
      variants: [{ w: '100 g', p: 85 }, { w: '250 g', p: 180 }, { w: '500 g', p: 340 }],
      inStock: true
    },
    {
      id: 'idly-karam', name: 'Idly Karam Podi', te: 'ఇడ్లీ కారం పొడి', heat: 3, color: '#d9481f',
      short: 'Fiery gunpowder for idli and dosa. Add ghee or gingelly oil.',
      description: 'Chana dal, urad dal and Guntur red chillies roasted with garlic and curry leaves, then ground coarse. Bold, spicy and made for soft idlis.',
      ingredients: 'Chana dal, urad dal, Guntur red chillies, garlic, curry leaves, sesame, salt',
      pairs: 'Idli, dosa, pesarattu, uttapam',
      images: ['img/products/idly-karam.jpg', 'img/products/idly-karam-pack.jpg', 'img/products/idly-karam-closeup.jpg'],
      variants: [{ w: '100 g', p: 65 }, { w: '250 g', p: 140 }, { w: '500 g', p: 265 }],
      inStock: true, bestseller: true
    },
    {
      id: 'sambar', name: 'Sambar Podi', te: 'సాంబార్ పొడి', heat: 2, color: '#e3a21a',
      short: 'Home-style sambar masala. Coriander, dals and fenugreek.',
      description: 'Coriander seeds, dals, red chillies, fenugreek, cumin, pepper and turmeric, each roasted separately and blended. Two spoons give a full pot of tangy, fragrant sambar.',
      ingredients: 'Coriander seeds, toor dal, chana dal, red chillies, fenugreek, cumin, pepper, turmeric, hing',
      pairs: 'Sambar, vegetable kootu, pulusu',
      images: ['img/products/sambar.jpg', 'img/products/sambar-pack.jpg', 'img/products/sambar-closeup.jpg'],
      variants: [{ w: '100 g', p: 80 }, { w: '250 g', p: 170 }, { w: '500 g', p: 320 }],
      inStock: true
    },
    {
      id: 'rasam', name: 'Rasam Podi', te: 'రసం పొడి', heat: 2, color: '#a3361c',
      short: 'Peppery rasam powder with cumin and curry leaves.',
      description: 'Black pepper, cumin, coriander, toor dal and red chillies roasted with curry leaves. Peppery and warming, for a quick charu on busy days.',
      ingredients: 'Coriander seeds, cumin, black pepper, toor dal, red chillies, curry leaves, turmeric',
      pairs: 'Rasam / charu, tomato rasam, soups',
      images: ['img/products/rasam.jpg', 'img/products/rasam-pack.jpg', 'img/products/rasam-closeup.jpg'],
      variants: [{ w: '100 g', p: 75 }, { w: '250 g', p: 160 }, { w: '500 g', p: 300 }],
      inStock: true
    }
  ]
};
