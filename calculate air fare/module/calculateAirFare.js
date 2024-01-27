
const calculateAirFare = function (departureCity, arrivalCity) {
		if(departureCity === 'Hyderabad' && arrivalCity === 'Pune') {
			var price = 1000;
			return price;
		}
		return null;
	}


module.exports = calculateAirFare;