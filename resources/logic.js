let thumbs = null;
let viewer = null;
let index_max = 0;
let comments_opened = false;
let current = 0;
let category = "latestuploads";

if (window.location.protocol == "http:") window.location = "https://" + window.location.href.substr(7);

function on_phereo_json_received () {
  if (thumbs && this.status == 200) {
    json = JSON.parse(this.responseText);
    media = []
    json.assets.forEach(asset => {
      const img = document.createElement("img");
      img.src = "/thumb/" + asset.id + ".jpg";
      img.title = asset.title;
      img["data-position"] = index_max;
      img["data-info"] = JSON.stringify(asset); 
      index_max += 1;
      img.addEventListener("click", e => {
        if (viewer) {
          viewer.postMessage({'stereopix_action': 'goto', 'position': e.target['data-position']}, 'https://stereopix.net');
          viewer.focus();
        }
        document.getElementById("stereopix_viewer").scrollIntoView();
      });
      media.push({"url": document.location.origin + "/img/" + asset.id + ".jpg" });
      thumbs.appendChild(img);
    });
    if (viewer)
      viewer.postMessage({'stereopix_action': 'list_add_json', 'media': {'media': media}}, 'https://stereopix.net');
    if (json.totalCount > index_max) {
      const imgnext = document.createElement("img");
      imgnext.src = "/next.webp";
      imgnext.title = "Load next images";
      imgnext.addEventListener("click", e => {
        e.target.remove();
        const req = new XMLHttpRequest();
        req.addEventListener("load", on_phereo_json_received);
        req.open("GET", "/api/" + category + "/" + index_max + ".json");
        req.send();
      });
      thumbs.appendChild(imgnext);
    }
  }
}

function on_phereo_json_userlist_received() {
  if (thumbs && this.status == 200) {
    if (index_max == 0) thumbs.innerText = '';
    json = JSON.parse(this.responseText);
    json.assets.forEach(asset => {
      const img = document.createElement("img");
      img.src = "/avatar/" + asset.id + ".jpg";
      img.title = asset.username;
      img["data-id"] = asset.id;
      index_max += 1;
      img.addEventListener("click", e => {
        load_user(e.target["data-id"]);
      });
      thumbs.appendChild(img);
    });
    if (json.totalCount > index_max) {
      const imgnext = document.createElement("img");
      imgnext.src = "/next.webp";
      imgnext.title = "Load next users";
      imgnext.addEventListener("click", e => {
        e.target.remove();
        const req = new XMLHttpRequest();
        req.addEventListener("load", on_phereo_json_userlist_received);
        req.open("GET", "/api/" + category + "/" + index_max + ".json");
        req.send();
      });
      thumbs.appendChild(imgnext);
    }
  }
}

function load_reset(cat) {
  document.getElementById("info_block").style.display = "none";
  category = cat;
  index_max = 0;
  current = 0;
  if (thumbs)
    thumbs.innerText = "";
  if (viewer)
    viewer.postMessage({'stereopix_action': 'list_clear'}, 'https://stereopix.net');
}

function load_category(cat) {
  load_reset(cat);
  const req = new XMLHttpRequest();
  req.addEventListener("load", on_phereo_json_received);
  req.open("GET", "/api/" + cat + "/0.json");
  req.send();
}

function load_search_user(username) {
  const u = "username:" + encodeURIComponent(username);
  load_reset(u);
  if (thumbs)
    thumbs.innerText = 'Searching users might be very slow...';
  const req = new XMLHttpRequest();
  req.addEventListener("load", on_phereo_json_userlist_received);
  req.open("GET", "/api/" + u + "/0.json");
  req.send();
}

function load_user(uid) {
  load_category("user:" + uid);
}

function format_date(v) {
  d = new Date(v*1000);
  function pad(i) { return ((i < 10) ? "0" : "") + i; }
  return d.getUTCFullYear() + "-" + pad(d.getUTCMonth() + 1) + "-" + pad(d.getUTCDate()) + " " + pad(d.getUTCHours()) + ":" + pad(d.getUTCMinutes())
}

window.addEventListener('message', function(e) {
	if (e.origin == 'https://stereopix.net') {
		if (e.data.type == 'viewerReady') {
			viewer = e.source;
      viewer.focus();

    } else if (e.data.type == 'mediumChanged') {
      document.getElementById("info_avatar").src = "data:,";
      document.getElementById("comments").innerText = "";
      comments_opened = false;
      if (thumbs) {
        tc = thumbs.children.item(current);
        if (tc) tc.classList.remove("active");
        tn = thumbs.children.item(e.data.position)
        if (tn) {
          tn.classList.add("active");
          json = JSON.parse(tn["data-info"]);
          document.getElementById("info_block").style.display = "inline-grid";
          document.getElementById("info_title").innerText = json.title;
          document.getElementById("info_desc").innerText = json.description;
          document.getElementById("info_views").innerText = json.views;
          document.getElementById("info_likes").innerText = json.likes;
          document.getElementById("info_comments").innerText = json.comments;
          document.getElementById("info_date").innerText = format_date(json.created);
          document.getElementById("info_user").innerText = json.user.name;
          document.getElementById("info_avatar").src = "/avatar/" + json.user.id + ".jpg";
          document.getElementById("info_avatar").onclick = e => { load_user(json.user.id); };
          if (json.comments > 0) {
            document.getElementById("info_block").addEventListener("click", e => {
              const req = new XMLHttpRequest();
              const on_com_loaded = e => {
                comjson = JSON.parse(req.responseText);
                comjson.data.forEach(com => {
                  const extdiv = document.createElement("div");
                  extdiv.classList.add("comment");
                  const comimg = document.createElement("img");
                  comimg.src = "/avatar/" + com.user.id + ".jpg";
                  comimg.onclick = e => { load_user(com.user.id); };
                  const intdiv = document.createElement("div");
                  intdiv.classList.add("col2");
                  extdiv.appendChild(comimg);
                  extdiv.appendChild(intdiv);
                  const p1 = document.createElement("p");
                  p1.innerText = " " + format_date(com.created);
                  const b = document.createElement("b");
                  b.innerText = com.user.name;
                  p1.insertBefore(b, p1.firstChild);
                  const p2 = document.createElement("p");
                  p2.innerText = com.body;
                  intdiv.appendChild(p1);
                  intdiv.appendChild(p2);
                  document.getElementById("comments").appendChild(extdiv);
                });
                req.removeEventListener("load", on_com_loaded);
              };
              req.addEventListener("load", on_com_loaded);
              req.open("GET", "/comments/" + json.id + ".json");
              if (!comments_opened) req.send();
              comments_opened = true;
            });
          }
        }
      }
      current = e.data.position;
    }
  }
});

window.addEventListener("DOMContentLoaded", e => {
  thumbs = document.getElementById("thumbs");

  document.getElementById("cat_l").addEventListener("click", e => load_category("latestuploads"));
  document.getElementById("cat_p").addEventListener("click", e => load_category("popular"));
  document.getElementById("cat_f").addEventListener("click", e => load_category("awards"));
  document.getElementById("cat_s").addEventListener("click", e => load_category("staffpicks"));

  document.getElementById("tag_form").addEventListener("submit", e => {
    e.preventDefault();
    load_category("tag:" + encodeURIComponent(document.getElementById("tag_input").value));
    return false;
  });
  document.getElementById("search_form").addEventListener("submit", e => {
    e.preventDefault();
    load_category("search:" + encodeURIComponent(document.getElementById("search_input").value));
    return false;
  });
  document.getElementById("searchuser_form").addEventListener("submit", e => {
    e.preventDefault();
    load_search_user(document.getElementById("searchuser_input").value);
    return false;
  });
});
