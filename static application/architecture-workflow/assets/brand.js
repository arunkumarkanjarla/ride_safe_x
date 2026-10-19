/* Change the product name in one place: edit BRAND_NAME and reload any page.
   (Pictures in the images folder keep the name they were rendered with.) */
var BRAND_NAME = "RideNova";
document.querySelectorAll(".brandname").forEach(function (e) { e.textContent = BRAND_NAME; });
document.title = document.title.replace("RideNova", BRAND_NAME);
