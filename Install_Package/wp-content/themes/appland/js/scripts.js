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


$('#carousel-feature').each(function(){
        $(this).carousel({
            interval: false
        });
    });
    
// Toggle class on feature buttons
$(".btn-group").on('click','a', function(){
    $(this).toggleClass('active').siblings().removeClass('active');
 });

});