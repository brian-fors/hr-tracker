'use strict';

/* Filters */

angular.module('hrtrackerApp.filters', []).filter('age', ["$filter", function($filter) {
	return function(date) {
		var yearNow = new Date().getYear();
		var monthNow = new Date().getMonth();
		var dateNow = new Date().getDate();

        var yearDob = new Date(date).getYear();
		var monthDob = new Date(date).getMonth();
		var dateDob = new Date(date).getDate();

        var yearAge = yearNow - yearDob;
		var monthAge = null;
		var dateAge = null;

		if (monthNow >= monthDob)
			monthAge = monthNow - monthDob;
		else {
			yearAge--;
			monthAge = 12 + monthNow - monthDob;
		}

		if (dateNow >= dateDob)
			dateAge = dateNow - dateDob;
		else {
			monthAge--;
			dateAge = 31 + dateNow - dateDob;
			if (monthAge < 0) {
				monthAge = 11;
				yearAge--;
			}
		}

        var hours = (new Date().getTime() - new Date(date).getTime()) / 36e5;
        if (dateAge > 1) {
            hours = hours/(24 * dateAge);
        }

        if ( (yearAge > 0) && (monthAge > 0) && (dateAge > 0) )
			return yearAge + "y " + monthAge + "m " + dateAge + "d";
		else if ( (yearAge > 0) && (monthAge > 0) && (dateAge == 0) )
			return yearAge + "y " + monthAge + "m";
		else if ( (yearAge > 0) && (monthAge == 0) && (dateAge > 0) )
			return yearAge + "y " + dateAge + "d";
		else if ( (yearAge > 0) && (monthAge == 0) && (dateAge == 0) )
			return yearAge + "y";
		else if ( (yearAge == 0) && (monthAge > 0) && (dateAge > 0) )
			return monthAge + "m " + dateAge + "d";
		else if ( (yearAge == 0) && (monthAge > 0) && (dateAge == 0) )
			return monthAge + "m";
		else if ( (yearAge == 0) && (monthAge == 0) && (dateAge > 1) )
			return dateAge + "d";
        else if ( (yearAge == 0) && (monthAge == 0) && (dateAge > 0) )
            return $filter('number')(hours, 2) + "h";
        else return "Could not calculate age";
	};
}]).filter('nameGivenFamily', function () {
    return function(p){
        var isArrayName = p && p.name && p.name[0];
        var personName;

        if (isArrayName) {
            personName = p && p.name && p.name[0];
            if (!personName) return null;

        } else {
            personName = p && p.name;
            if (!personName) return null;
        }

        var user;
        if (Object.prototype.toString.call(personName.family) === '[object Array]') {
            user = personName.given.join(" ") + " " + personName.family.join(" ");
        } else {
            user = personName.given.join(" ") + " " + personName.family;
        }
        if (personName.suffix) {
            user = user + ", " + personName.suffix.join(", ");
        }
        return user;
    };
}).filter('textOrNumber', function ($filter) {
        return function (input, fractionSize) {
            if (isNaN(input)) {
                return input;
            } else {
                return $filter('number')(input, fractionSize);
            }
        };
    });