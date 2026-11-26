update public.instagram_posts t set slides=v.slides, photo_count=v.pc from (values
('DTprmCekXil', $j$[{"type":"photo","src":"/photos/ig/DTprmCekXil/1.jpg","width":1279,"height":852},{"type":"photo","src":"/photos/ig/DTprmCekXil/2.jpg","width":1044,"height":696},{"type":"photo","src":null,"width":null,"height":null}]$j$::jsonb, 2),
('DSuorzWEX_T', $j$[{"type":"photo","src":"/photos/ig/DSuorzWEX_T/1.jpg","width":1045,"height":698},{"type":"photo","src":null,"width":null,"height":null},{"type":"photo","src":"/photos/ig/DSuorzWEX_T/3.jpg","width":1046,"height":702}]$j$::jsonb, 2),
('DSXiL3kkWDL', $j$[{"type":"photo","src":"/photos/ig/DSXiL3kkWDL/1.jpg","width":1440,"height":1085},{"type":"photo","src":null,"width":null,"height":null}]$j$::jsonb, 1),
('DOLjO0XkYwW', $j$[{"type":"photo","src":"/photos/ig/DOLjO0XkYwW/1.jpg","width":864,"height":583},{"type":"photo","src":null,"width":null,"height":null},{"type":"photo","src":"/photos/ig/DOLjO0XkYwW/3.jpg","width":866,"height":586}]$j$::jsonb, 2),
('DOGV3omj-t3', $j$[{"type":"photo","src":"/photos/ig/DOGV3omj-t3/1.jpg","width":1440,"height":1085},{"type":"photo","src":null,"width":null,"height":null}]$j$::jsonb, 1),
('DNk8flXyHTv', $j$[{"type":"photo","src":"/photos/ig/DNk8flXyHTv/1.jpg","width":1107,"height":830},{"type":"photo","src":null,"width":null,"height":null}]$j$::jsonb, 1),
('DNVZVQ4vHYn', $j$[{"type":"photo","src":"/photos/ig/DNVZVQ4vHYn/1.jpg","width":1440,"height":1079},{"type":"photo","src":null,"width":null,"height":null},{"type":"photo","src":"/photos/ig/DNVZVQ4vHYn/3.jpg","width":1107,"height":830}]$j$::jsonb, 2),
('DMDGFMMPBTN', $j$[{"type":"photo","src":"/photos/ig/DMDGFMMPBTN/1.jpg","width":1107,"height":830},{"type":"photo","src":null,"width":null,"height":null}]$j$::jsonb, 1)
) v(code,slides,pc) where t.code=v.code;
