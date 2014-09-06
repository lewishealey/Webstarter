// DOM Ready
$(function() {


// Grid & List Toggle 

$("#grid-select").click(function(e){
event.preventDefault();
$("#list").fadeToggle("fast");  
$("#grid").delay(300).fadeToggle("slow");    
});

$("#list-select").click(function(e){
event.preventDefault();
$("#grid").fadeToggle("fast");  
$("#list").delay(300).fadeToggle("slow");    
});



});