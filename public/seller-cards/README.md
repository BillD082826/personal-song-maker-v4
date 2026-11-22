# Seller card artwork

Three approved designs, each in color/black-and-white and front/back. SVGs retain vector typography and illustration from the reviewed 3.5x2-inch cards. They intentionally contain NO seller name, referral code, or QR image. `seller-cards.js` overlays the selected seller's code and actual QR at print/preview time.

Print geometry matches the existing physically checked Avery 5876 implementation: Letter, .75-inch side margin, .5-inch top margin, 2x5 grid of 3.5x2-inch cells, existing -.125-inch content Y adjustment. White margins, no bleed. Confirm duplex feed and actual-size alignment on plain paper before using stock.

Admin retains Classic printing and adds Business Card Designs per seller. Seller Portal uses its existing bearer authentication; only its own referral QR data is included in that authenticated response. No public seller listing or new credentials.
