var menu_json = require('./menu.json');
var cost_json = require('./prices.json');
var fs = require('fs');

var express = require("express");
var app = express();

/* serves main page */
app.get("/", function(req, res) {
  res.sendfile('index.html')
});

app.get("/mealme", function(req, res) {
  /* some server side logic */
  res.send(get_foods(req.query.list, req.query.val, 1, req.query.optimal));
});

var port = process.env.PORT || 9001;
app.listen(port, function() {
});

function get_foods(banned_list_str, total_val, max, sort_on)
{
  var data = [];
  var dupe_list = [];
  var banned_list = [];
  if(banned_list_str != '')
  {
    banned_list = banned_list_str.split(',');
  }

  total_val = total_val*100;

  if(max == '' || max == 0)
  {
    max = 1;
  }

  for(var i = 0;i< menu_json.length;i++)
  {
    if(menu_json[i].ITEM.indexOf('g)') != -1)
    {
      var name_regex_res = menu_json[i].ITEM.match(/(.+) \([0-9]+ g\)/);
      if(name_regex_res != null)
      {
        var regex_res = menu_json[i].ITEM.match(/\(([0-9]+) g\)/);
        if(regex_res != null && typeof regex_res[1] != 'undefined')
        {
          var price = 0;
          for(var j= 0;j<   cost_json.length;j++)
          {
            if(name_regex_res[1].indexOf(cost_json[j].name) != -1)
            {
              price = cost_json[j].price;
            }
          }
          var item_obj = {
            value : price,
            weight: regex_res[1] ,
            name: name_regex_res[1],
            calories: parseInt(menu_json[i].CAL),
            pieces: parseInt(max)
          };

          var is_banned = false;
          for(var k = 0;k<banned_list.length;k++)
          {
            if(item_obj.name.indexOf(banned_list[k]) != -1)
            {
              is_banned = true;
              break;
            }
          }

          if(price != 0 && !is_banned && dupe_list.indexOf(item_obj.name) == -1)
          {
            dupe_list.push(item_obj.name);
            data.push(item_obj);
          }
        }
      }
    }
  }

  var m= [[0]]; // maximum pack value found so far
  var b= [[0]]; // best combination found so far
  var opts= [0]; // item index for 0 of item 0
  var P= [1]; // item encoding for 0 of item 0
  var choose= 0;
  for (var j= 0; j<data.length; j++) {
    opts[j+1]= opts[j]+data[j].pieces; // item index for 0 of item j+1
    P[j+1]= P[j]*(1+data[j].pieces); // item encoding for 0 of item j+1
  }
  for (var j= 0; j<opts[data.length]; j++) {
    m[0][j+1]= b[0][j+1]= 0; // best values and combos for empty pack: nothing
  }
  for (var w=1; w<=total_val; w++) {
    m[w]= [0];
    b[w]= [0];
    for (var j=0; j<data.length; j++) {
      var N= data[j].pieces; // how many of these can we have?
      var base= opts[j]; // what is the item index for 0 of these?
      for (var n= 1; n<=N; n++) {
        var W= n*data[j].value; // how much do these items weigh?
        var s= w>=W ?1 :0; // can we carry this many?
        var v= s*n*data[j][sort_on]; // how much are they worth?
        var I= base+n; // what is the item number for this many?
        var wN= w-s*W; // how much other stuff can we be carrying?
        var C= n*P[j] + b[wN][base]; // encoded combination
        m[w][I]= Math.max(m[w][I-1], v+m[wN][base]); // best weight
        choose= b[w][I]= m[w][I]>m[w][I-1] ?C :b[w][I-1];
      }
    }
  }
  var best= [];
  for (var j= data.length-1; j>=0; j--) {
    best[j]= Math.floor(choose/P[j]);
    choose-= best[j]*P[j];
  }
  var index_str = fs.readFileSync('div_form.html','utf8');

  var unit = 'g';
  var title = sort_on.toUpperCase();
  if(sort_on == 'calories')
  {
    unit = 'cal';
  }

  var out='<script src="https://code.jquery.com/jquery-2.1.4.min.js"></script><body style="background:#EFEFEF;"><link href=\'https://fonts.googleapis.com/css?family=Roboto\' rel=\'stylesheet\' type=\'text/css\'><div style="font-family: \'Roboto\', sans-serif;text-align:center;"><div style="font-size:50px;">YOU SHOULD BUY</div><table style="margin:auto;margin-top:50px;text-align:center;"><tr><td><b>Count</b></td><td style="margin-left:10px;margin-right:10px;"><b>Item</b></td><th>PRICE</th><th>'+title+'</th>';
  var wgt= 0;
  var val= 0;

  for (var i= 0; i<best.length; i++) {
    if (0==best[i]) continue;
    out+='</tr><tr style="text-align:center;font-size:22px;padding:10px;"><td style="padding:10px;">'+best[i]+'</td><td>'+data[i].name+'</td><td>$'+data[i].value/100+'</td><td>'+data[i][sort_on]+unit+'</td>'
    wgt+= best[i]*data[i].value;
    val+= best[i]*data[i][sort_on];
  }
  out+= '</tr></table><br/><span style="font-size:50px;">Total value: <span style="font-weight:bold;color:green;">$'+wgt/100+'</span></span>';
  out+= '<br/><span style="font-size:50px;">Total weight: <span style="font-weight:bold;color:green;">'+val;
  if(sort_on == 'weight') out+='g</span></span>';
  if(sort_on == 'calories') out+='cal</span></span>';
  out+= '</div></body>';

  out+=index_str.toString('ascii', 0, index_str.length);

  out+= "<script>$('#val_div').val("+total_val/100+");$('#ban_div').val('"+banned_list_str+"');$('#max_div').val("+max+");$('#"+sort_on+"').click();</script>";


  return out;
}