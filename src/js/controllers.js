'use strict';

angular.module('hrtrackerApp.controllers', []).controller('hrtrackerCtrl', ['$scope', '$filter', function ($scope, $filter ) {
    $scope.fhirVersions = [
        {
            "fhirVersion": ["0.5.0"],
            "obsDateTimePath": "appliesDateTime"
        },
        {
            "fhirVersion": ["1.0.0", "1.0.1", "1.0.2"],
            "obsDateTimePath": "effectiveDateTime"
        }
    ];
    $scope.currentFhirVersion = $scope.fhirVersions[1];
    $scope.patient = {
        name: ''
    };
    $scope.name = '';

    $scope.hours = function (observation, dob) {
        var hours = (new Date(observation).getTime() - new Date(dob).getTime()) / 36e5;
        return (hours > 1000 || hours < -1000) ? "-----" : hours;
    };

    $scope.obsDateIsValid = false;
    $scope.obsValue = 0;
    $scope.obsValueIsValid = false;
    $scope.isSaveDisabled = true;
    $scope.isReadOnly = true;
    $scope.enterObsVisible = false;
    $scope.showPatientBanner = false;

    var newPoint = [];
    var lastPoint = [];
    var heartrate = [];

    $scope.$watchGroup(['obsValue', 'obsDate'], function() {
        $scope.obsValueIsValid = (!isNaN($scope.obsValue) && $scope.obsValue > 0);
        $scope.obsDateIsValid = validateDate($scope.obsDate);
        if ($scope.obsValueIsValid && $scope.obsDateIsValid) {
            $scope.isSaveDisabled = false;
            if (newPoint.length === 0 && lastPoint.length > 0)
                newPoint.push(lastPoint[0]);
            if (newPoint.length > 1)
                newPoint.pop();
            newPoint.push([$scope.hours($scope.obsDate, $scope.patient.dob), parseFloat($scope.obsValue)]);
        }
    });

    $scope.toggleObsVisible = function() {
        if ($scope.obsDate === undefined ) {
            $scope.obsDate = $filter('date')(new Date(), 'MM/dd/yyyy HH:mm');
        }
        $scope.enterObsVisible = !$scope.enterObsVisible;
    };

    function validateDate(date) {
        var newDate = new Date(date);
        if ( isNaN(newDate.getTime()))
            return false;

        return true;
    }

    $scope.clearNewPoint = function() {
        while (newPoint.length > 0) {
            newPoint.pop();
        }
    };

    $scope.setDefaults = function() {
        $scope.obsDate = $filter('date')(new Date(), 'MM/dd/yyyy HH:mm');
        $scope.obsValue = 0;
    };

    $scope.saveObs = function(obsDate, obsValue) {

        if (!validateDate(obsDate))
            return;

        var newObs = formatObservation('{ \
            "resourceType" : "Observation",\
            "code" :\
            {\
                "coding" :\
                    [\
                        {\
                            "system" : "http://loinc.org",\
                            "code" : "8867-4",\
                            "display" : "Heart Rate"\
                        }\
                    ]\
            },\
            "valueQuantity" :\
            {\
                "value" : {0},\
                "unit" : "bpm",\
                "code" : "bpm"\
            },\
            "' + $scope.currentFhirVersion.obsDateTimePath +'" : "{1}",\
            "status" : "final",\
            "subject" :\
            {\
                "reference" : "Patient/{2}"\
            }\
        }',obsValue, new Date(obsDate).toISOString(), $scope.patient.id);

        $scope.smart.api.create({type: "Observation", data: JSON.stringify(JSON.parse(newObs))})
            .done(function(){
                queryHeartrateData($scope.smart);
            }).fail(function(){
                console.log("failed to create observation", arguments);
            });
    };

    $scope.connectDevice = function() {
        alert("Device connected.");
        var request = new XMLHttpRequest();
        request.open("GET", "/data/vitals.xml", false);
        request.send();
        var xml = request.responseXML;
        var observations = xml.getElementsByTagName("observation");
        for(var i = 0; i < observations.length; i++) {
            var obsValue = observations[i].getElementsByTagName("value")[0].childNodes[0].nodeValue;
            var obsDate = observations[i].getElementsByTagName("date")[0].childNodes[0].nodeValue;
            console.log(obsValue + " " + obsDate);
            setTimeout($scope.saveObs(obsDate, obsValue), 3000);
        }
    }

    function formatObservation(format) {
        var args = Array.prototype.slice.call(arguments, 1);
        return format.replace(/{(\d+)}/g, function(match, number) {
            return typeof args[number] != 'undefined'
                ? args[number]
                : match
                ;
        });
    }

    function hasWriteScope(smart){
        var scope = smart.tokenResponse.scope;
        var scopes = scope ? scope.split(" ") : "";

        angular.forEach(scopes, function (value) {
            if (value === "patient/*.*" ||
                value === "patient/*.write" ||
                value === "patient/Observation.write" ||
                value === "user/*.write" ||
                value === "user/*.*"
            ){
                $scope.isReadOnly = false;
            }
        });
    }

    function queryConformanceStatement(smart){
        var deferred = $.Deferred();
        $.when(smart.api.conformance({}))
            .done(function(statement){
                angular.forEach($scope.fhirVersions, function (versionInfo) {
                        angular.forEach(versionInfo.fhirVersion, function (version) {
                            if (version == statement.data.fhirVersion) {
                                $scope.currentFhirVersion = versionInfo;
                        }
                    });
                });
                deferred.resolve();
            }).fail(function(error){
                deferred.resolve();
            });
        return deferred;
    }
    function queryPatient(smart){
        var deferred = $.Deferred();
        $.when(smart.patient.read())
            .done(function(patient){
                $scope.patient.name = $filter('nameGivenFamily')(patient);

                // Check for the patient-birthTime Extension
                if (typeof patient.extension !== "undefined") {
                    angular.forEach(patient.extension, function (extension) {
                        if (extension.url == "http://hl7.org/fhir/StructureDefinition/patient-birthTime") {
                            $scope.patient.dob = extension.valueDateTime;
                        }
                    });
                }
                // if dob wasn't set by the extension
                if ($scope.patient.dob === undefined) {
                    $scope.patient.dob = patient.birthDate;
                }
                $scope.patient.dob = new Date($scope.patient.dob);

                $scope.patient.sex = patient.gender;
                $scope.patient.id  = patient.id;
                deferred.resolve();
            });
        return deferred;
    }


    function queryHeartrateData(smart) {
        var deferred = $.Deferred();

        $.when(smart.patient.api.search({type: "Observation", query: {"code": 'http://loinc.org|8867-4'}, count: 50}))
            .done(function(obsSearchResult){
                var observations = [];
                if (obsSearchResult.data.entry) {
                    obsSearchResult.data.entry.forEach(function(obs){
                        obs.resource[$scope.currentFhirVersion.obsDateTimePath] = new Date (obs.resource[$scope.currentFhirVersion.obsDateTimePath]);
                        observations.push(obs.resource);
                    });
                }
                if(observations){
                    $scope.hrvalues = $filter('orderBy')(observations,$scope.currentFhirVersion.obsDateTimePath);
                }

                while (heartrate.length > 0) {
                    heartrate.pop();
                }
                angular.forEach($scope.hrvalues, function (value) {
                    if(validateDate(value[$scope.currentFhirVersion.obsDateTimePath])) {
                        heartrate.push([value.effectiveDateTime, parseFloat(value.valueQuantity.value)]);
                    }
                });
                while (lastPoint.length > 0) {
                    lastPoint.pop();
                }
                if (heartrate.length > 0) {
                    lastPoint.push(heartrate[heartrate.length - 1]);
                }

                while (newPoint.length > 0) {
                    newPoint.pop();
                }
                $scope.$apply();
                deferred.resolve();
            }).fail(function(){deferred.resolve();});
        return deferred;
    }


    FHIR.oauth2.ready(function(smart){
        $scope.smart = smart;
        $scope.showPatientBanner = !(smart.tokenResponse.need_patient_banner === false);
        
        queryConformanceStatement(smart).done(function(){
            hasWriteScope(smart);
            queryPatient(smart).done(function(){
                queryHeartrateData(smart).done(function(){
                    $scope.$digest();
                });
                queryHeartrateData(smart).done(function(){
                    $scope.chartConfig = {
                        options: {
                            tooltip: {
                                crosshairs: true,
                                valueDecimals: 0,
                                headerFormat: '<span style="font-size: 10px">{point.key:.2f}</span><br/>'
                            },
                            legend: {
                                enabled: false
                            }
                        },
                        xAxis: {
                            minPadding: 0,
                            maxPadding: 0,
                            gridLineWidth: 1,
                            tickInterval: 24,
                            title: {
                                text: 'Date/time'
                            }
                        },
                        yAxis: {
                            minPadding: 0,
                            maxPadding: 0,
                            title: {
                                text: 'Heart rate (bpm)'
                            },                                
                        },
                        plotOptions: {
                            series: {
                                fillOpacity: 0.35
                            }
                        },
                        series: [
                            {
                                name: 'Heart rate',
                                data: heartrate,
                                color: '#0077FF',
                                type: 'line'
                            }
                        ],
                        title: {
                            text: 'Heart rate chart (most recent 50 observations)'
                        },
                        credits: {
                            enabled: false
                        }
                    };
                    $scope.$digest();
                });
            });
        });
    });
}]);