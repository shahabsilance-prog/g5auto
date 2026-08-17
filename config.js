/* =====================================================================
   G5 Auto — Configuration constants
   Shared reference data: makes, models, locations, marketplaces, etc.
   Exposed as window.G5_CONFIG so views can import without duplication.
   ===================================================================== */
(function (global) {
  'use strict';

  const COMMON_MODELS = {
    'Toyota': ['Camry', 'Corolla', 'RAV4', 'Highlander', 'Tacoma', 'Tundra', '4Runner', 'Prius', 'Avalon', 'Sienna', 'Supra', 'GR86'],
    'Honda': ['Accord', 'Civic', 'CR-V', 'Pilot', 'Odyssey', 'HR-V', 'Ridgeline', 'Insight', 'Passport'],
    'Ford': ['F-150', 'F-250', 'F-350', 'Explorer', 'Escape', 'Bronco', 'Mustang', 'Edge', 'Expedition', 'Ranger', 'Maverick', 'Transit'],
    'Chevrolet': ['Silverado', 'Equinox', 'Traverse', 'Tahoe', 'Suburban', 'Camaro', 'Malibu', 'Colorado', 'Blazer', 'Trailblazer', 'Corvette', 'Express'],
    'Nissan': ['Altima', 'Sentra', 'Rogue', 'Pathfinder', 'Frontier', 'Maxima', 'Kicks', 'Murano', 'Armada', 'Titan'],
    'Jeep': ['Wrangler', 'Grand Cherokee', 'Cherokee', 'Compass', 'Renegade', 'Gladiator', 'Wagoneer'],
    'Ram': ['1500', '2500', '3500', 'ProMaster', 'ProMaster City'],
    'GMC': ['Sierra', 'Yukon', 'Terrain', 'Acadia', 'Canyon', 'Hummer EV'],
    'Hyundai': ['Sonata', 'Elantra', 'Tucson', 'Santa Fe', 'Kona', 'Palisade', 'Ioniq 5', 'Accent', 'Venue'],
    'Kia': ['Forte', 'K5', 'Sportage', 'Sorento', 'Telluride', 'Seltos', 'Soul', 'Carnival', 'Stinger', 'EV6'],
    'Subaru': ['Outback', 'Forester', 'Crosstrek', 'Impreza', 'Legacy', 'Ascent', 'BRZ', 'WRX'],
    'Mazda': ['CX-5', 'CX-50', 'CX-9', 'Mazda3', 'Mazda6', 'MX-5 Miata', 'CX-30'],
    'Volkswagen': ['Jetta', 'Taos', 'Tiguan', 'Atlas', 'Golf GTI', 'ID.4', 'Passat', 'Arteon'],
    'BMW': ['3 Series', '5 Series', '7 Series', 'X3', 'X5', 'X7', 'M3', 'M4', 'iX', 'i4'],
    'Mercedes-Benz': ['C-Class', 'E-Class', 'S-Class', 'GLC', 'GLE', 'GLS', 'A-Class', 'CLA', 'AMG GT'],
    'Audi': ['A4', 'A6', 'A8', 'Q5', 'Q7', 'Q8', 'e-tron', 'TT', 'R8', 'RS5'],
    'Lexus': ['RX', 'ES', 'IS', 'GX', 'NX', 'UX', 'LS', 'LC', 'LX'],
    'Acura': ['MDX', 'RDX', 'Integra', 'TLX', 'ZDX'],
    'Infiniti': ['Q50', 'Q60', 'QX50', 'QX55', 'QX60', 'QX80'],
    'Cadillac': ['Escalade', 'XT5', 'XT6', 'CT5', 'CT4', 'Lyriq'],
    'Buick': ['Enclave', 'Encore', 'Envision', 'LaCrosse', 'Regal'],
    'Lincoln': ['Navigator', 'Aviator', 'Corsair', 'Nautilus', 'Explorer'],
    'Volvo': ['XC60', 'XC90', 'XC40', 'S60', 'S90', 'V60', 'C40 Recharge'],
    'Mitsubishi': ['Outlander', 'Eclipse Cross', 'Mirage', 'Outlander Sport'],
    'Tesla': ['Model 3', 'Model Y', 'Model S', 'Model X', 'Cybertruck'],
    'Porsche': ['911', 'Cayenne', 'Macan', 'Taycan', 'Panamera', 'Cayman', 'Boxster'],
    'Land Rover': ['Range Rover', 'Discovery', 'Defender', 'Range Rover Sport', 'Range Rover Evoque', 'Range Rover Velar'],
    'Chrysler': ['Pacifica', '300'],
    'Dodge': ['Charger', 'Challenger', 'Durango', 'Hornet', 'Ram Van'],
    'Other': ['(Other — type model below)']
  };

  const DAMAGE_OPTIONS = ['None', 'Front bumper', 'Rear bumper', 'Left fender', 'Right fender', 'Left door', 'Right door', 'Hood', 'Trunk/Tailgate', 'Windshield', 'Headlight', 'Tail light', 'Mirror', 'Tire(s)', 'Wheel(s)', 'Radiator', 'Brakes', 'Transmission', 'Engine', 'Suspension', 'Exhaust', 'Interior', 'Paint/Scratch', 'Dent', 'Rust', 'Flood damage', 'Frame damage', 'Multiple areas'];

  const COMMON_SELLERS = ['Private Seller', 'Copart', 'IAAI (Insurance Auto)', 'Manheim', 'ADESA', 'Facebook Marketplace', 'Craigslist', 'OfferUp', 'Dealer Auction', 'Wholesale', 'Carvana', 'Other'];

  const COMMON_LOCATIONS = ['Charlotte, NC', 'Concord, NC', 'Gastonia, NC', 'Mooresville, NC', 'Huntersville, NC', 'Matthews, NC', 'Monroe, NC', 'Rock Hill, SC', 'Salisbury, NC', 'Asheboro, NC', 'Statesville, NC', 'Lincolnton, NC', 'Shelby, NC', 'Kannapolis, NC', 'Hickory, NC', 'Other'];

  const CLT_AREAS = ['charlotte', 'concord', 'gastonia', 'mooresville', 'huntersville', 'matthews', 'monroe', 'rock-hill', 'salisbury', 'asheboro', 'statesville', 'lincolnton', 'shelby', 'kannapolis', 'hickory'];

  /**
   * Marketplace search-site definitions.
   * Each `build(ctx)` returns a URL the user opens in a new tab.
   * `tier` controls the badge: "direct" = filters fully applied, "text" = keyword only.
   */
  const searchSites = [
    { name: 'Facebook Marketplace', tag: 'Local', tier: 'direct', detail: 'Charlotte metro area — price filters apply', build(ctx) { let u = `https://www.facebook.com/marketplace/charlotte/search/?query=${encodeURIComponent(ctx.fullText)}`; if (ctx.priceMin) u += `&minPrice=${ctx.priceMin}`; if (ctx.priceMax) u += `&maxPrice=${ctx.priceMax}`; return u; } },
    { name: 'Craigslist Charlotte', tag: 'Classifieds', tier: 'direct', detail: 'Direct search — filters in URL', build(ctx) { let q = `query=${encodeURIComponent(ctx.fullText)}`; if (ctx.priceMin) q += `&min_price=${ctx.priceMin}`; if (ctx.priceMax) q += `&max_price=${ctx.priceMax}`; return `https://charlotte.craigslist.org/search/cta?${q}`; } },
    { name: 'Craigslist Greensboro', tag: 'Classifieds', tier: 'direct', detail: 'Asheboro / Triad area', build(ctx) { let q = `query=${encodeURIComponent(ctx.fullText)}`; if (ctx.priceMin) q += `&min_price=${ctx.priceMin}`; if (ctx.priceMax) q += `&max_price=${ctx.priceMax}`; return `https://greensboro.craigslist.org/search/cta?${q}`; } },
    { name: 'Craigslist Hickory', tag: 'Classifieds', tier: 'direct', detail: 'Western NC area', build(ctx) { let q = `query=${encodeURIComponent(ctx.fullText)}`; if (ctx.priceMin) q += `&min_price=${ctx.priceMin}`; if (ctx.priceMax) q += `&max_price=${ctx.priceMax}`; return `https://hickory.craigslist.org/search/cta?${q}`; } },
    { name: 'OfferUp', tag: 'Local', tier: 'direct', detail: 'Charlotte area — price range applied', build(ctx) { let u = `https://offerup.com/search?q=${encodeURIComponent(ctx.fullText)}&location=charlotte`; if (ctx.priceMin) u += `&PRICE_MIN=${ctx.priceMin}`; if (ctx.priceMax) u += `&PRICE_MAX=${ctx.priceMax}`; return u; } },
    { name: 'Copart', tag: 'Auction', tier: 'text', detail: 'Live auction bids — not fixed price', build(ctx) { return `https://www.copart.com/lotSearchResults?free=true&query=${encodeURIComponent(ctx.fullText)}&location=charlotte`; } },
    { name: 'IAAI (Insurance Auto)', tag: 'Auction', tier: 'text', detail: 'Salvage auctions — Charlotte', build(ctx) { return `https://www.iaai.com/Vehicles/Search?Keywords=${encodeURIComponent(ctx.fullText)}`; } },
    { name: 'CarGurus', tag: 'Marketplace', tier: 'direct', detail: 'Charlotte area deals', build(ctx) { return `https://www.cargurus.com/Cars/inventorylisting/viewDetailsFilterViewInventoryListing.action?zip=28202&showNegotiable=true&sortDir=ASC&sourceContext=carGurusHomePageModel&distance=${ctx.radius || '50'}&sortType=DEAL_SCORE&entitySelectingHelper.selectedEntity=${encodeURIComponent(ctx.fullText)}`; } },
    { name: 'Autotrader', tag: 'Marketplace', tier: 'direct', detail: 'Charlotte NC listings', build(ctx) { return `https://www.autotrader.com/cars-for-sale/all-cars/${encodeURIComponent(ctx.fullText.replace(/\s+/g, '-').toLowerCase())}/charlotte-nc-28202?searchRadius=${ctx.radius || '50'}`; } },
    { name: 'Cars.com', tag: 'Marketplace', tier: 'direct', detail: 'Near Charlotte, NC', build(ctx) { return `https://www.cars.com/shopping/results/?keyword=${encodeURIComponent(ctx.fullText)}&zip=28202&maximum_distance=${ctx.radius || '50'}`; } },
    { name: 'Carvana', tag: 'Online Dealer', tier: 'text', detail: 'Delivers to Charlotte area', build(ctx) { return `https://www.carvana.com/cars/${encodeURIComponent(ctx.fullText.replace(/\s+/g, '-').toLowerCase())}`; } },
    { name: 'TrueCar', tag: 'Marketplace', tier: 'text', detail: 'New & used — Charlotte area pricing', build(ctx) { return `https://www.truecar.com/used-cars-for-sale/listings/${encodeURIComponent(ctx.fullText.replace(/\s+/g, '-').toLowerCase())}/buyer-market/charlotte-nc/`; } },
    { name: 'CarFax', tag: 'Research', tier: 'text', detail: 'Vehicle history & listings', build(ctx) { return `https://www.carfax.com/Used-${encodeURIComponent(ctx.fullText.replace(/\s+/g, '_'))}_w282`; } },
    { name: 'Edmunds', tag: 'Research', tier: 'text', detail: 'Pricing & used car listings', build(ctx) { return `https://www.edmunds.com/inventory/srp.html?make=${encodeURIComponent(ctx.make || '')}&model=${encodeURIComponent(ctx.car || '')}&radius=${ctx.radius || '50'}&zip=28202`; } }
  ];

  global.G5_CONFIG = {
    COMMON_MODELS, DAMAGE_OPTIONS, COMMON_SELLERS, COMMON_LOCATIONS, CLT_AREAS, searchSites
  };
})(window);
